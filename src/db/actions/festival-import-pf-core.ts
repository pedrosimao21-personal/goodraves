import { db } from "@/db";
import { eq, sql } from "drizzle-orm";
import { festivals, festivalArtists, festivalTimetableSlots } from "@/db/schema";
import { findExistingFestivalByNameDate, deleteB2bSets, persistLineup, insertTimetableSlots, checkExistingLineup, backfillMissingImage } from "./festival-helpers";
import { resolveMergedFestivalId } from "./festival-merge-lookup";
import { fetchPFEventHtml } from "@/services/partyflock/client";
import { toIsoDate } from "@/lib/dates";
import { parsePFEventPage } from "@/services/partyflock/parser";
import { syncFestivalGenres } from "./festival-genres";
import { getCountryIsoCode } from "@/utils/location-normalizer";

/**
 * Partyflock import internals shared by the "use server" actions in
 * festival-import-pf.ts and the context-free callers below. Deliberately no
 * "use server" — festival-import-pf.ts is reachable from client code (via
 * the festivals.ts barrel), so an inline "use server" on individual
 * functions there still requires the FILE containing them to be a proper
 * server-module boundary; a plain shared file with no directive at all is
 * what actually keeps everything here off the client bundle.
 */

/** Fetch only the og:image URL for a Partyflock event by party ID. No rate
 * limiting of its own — festival-import-pf.ts's exported action adds that
 * before calling in; internal callers (below) don't need it. */
export async function fetchPFEventImageUrlCore(partyId: string): Promise<string | null> {
  if (!partyId || !/^\d+$/.test(partyId)) return null;

  const html = await fetchPFEventHtml(partyId);
  if (!html) return null;

  const parsed = parsePFEventPage(html);
  return parsed.imageUrl;
}

/** Delete a festival's lineup, B2B sets, and timetable (leaves the festival row intact). */
export async function clearPFFestivalRelations(festivalId: string): Promise<void> {
  await deleteB2bSets(festivalId);

  await db
    .delete(festivalArtists)
    .where(eq(festivalArtists.festivalId, festivalId));

  await db
    .delete(festivalTimetableSlots)
    .where(eq(festivalTimetableSlots.festivalId, festivalId));
}

type ParsedPFEvent = ReturnType<typeof parsePFEventPage>;

/** Fetch a Partyflock event page and parse it. Returns null if unavailable/invalid. */
async function fetchAndParsePFEvent(partyId: string): Promise<ParsedPFEvent | null> {
  const html = await fetchPFEventHtml(partyId);
  if (!html) return null;

  const parsed = parsePFEventPage(html);
  if (!parsed.name) return null;

  return parsed;
}

/** Fetch from partyflock.nl, parse, and persist the festival + lineup + timetable. */
export async function importPFEventCore(
  partyId: string,
  festivalId: string,
  opts?: { force?: boolean }
): Promise<string | null> {
  const parsed = await fetchAndParsePFEvent(partyId);
  if (!parsed) return null;

  return persistPFEvent(festivalId, partyId, parsed, opts);
}

/** Persist a parsed Partyflock event (festival row + lineup + B2B + timetable). */
async function persistPFEvent(
  festivalId: string,
  partyId: string,
  parsed: ParsedPFEvent,
  opts?: { force?: boolean; skipNameDateDedupe?: boolean }
): Promise<string | null> {
  if (!parsed.name) return null;

  const date = parsed.date ?? toIsoDate(new Date());

  if (!opts?.skipNameDateDedupe) {
    const existingId = await findExistingFestivalByNameDate(parsed.name, date);
    if (existingId && existingId !== festivalId) {
      return existingId;
    }
  }

  // On a forced re-import, rebuild the lineup from scratch so dropped artists are
  // removed and B2B sets aren't duplicated (createB2bSets always inserts). Runs
  // only after a successful parse and once we're committed to this festival id,
  // so a failed fetch never wipes a good lineup. User ratings/attendance survive:
  // they key on (userId, festivalId, artistId), not the lineup join.
  if (opts?.force) {
    await clearPFFestivalRelations(festivalId);
  }

  // `parsed.country` is already normalized to English by the parser
  // (Partyflock is the Dutch source — e.g. "Duitsland" -> "Germany").
  const festivalValues = {
    id: festivalId,
    name: parsed.name,
    date,
    endDate: parsed.endDate,
    venue: parsed.venue,
    location: parsed.location,
    countryCode: getCountryIsoCode(parsed.country),
    countryName: parsed.country,
    source: "partyflock" as const,
    sourceId: partyId,
    imageUrl: parsed.imageUrl,
    latitude: parsed.latitude,
    longitude: parsed.longitude,
    interestedCount: parsed.interestedCount,
    visitorsCount: parsed.visitorsCount,
  };

  if (opts?.force) {
    await db
      .insert(festivals)
      .values(festivalValues)
      .onConflictDoUpdate({
        target: festivals.id,
        set: {
          name: festivalValues.name,
          date: festivalValues.date,
          endDate: festivalValues.endDate,
          venue: festivalValues.venue,
          location: festivalValues.location,
          countryCode: festivalValues.countryCode,
          countryName: festivalValues.countryName,
          imageUrl: festivalValues.imageUrl,
          latitude: festivalValues.latitude,
          longitude: festivalValues.longitude,
          sourceId: festivalValues.sourceId,
          interestedCount: sql`COALESCE(${festivalValues.interestedCount}, ${festivals.interestedCount})`,
          visitorsCount: sql`COALESCE(${festivalValues.visitorsCount}, ${festivals.visitorsCount})`,
        },
      });
  } else {
    await db
      .insert(festivals)
      .values(festivalValues)
      .onConflictDoUpdate({
        target: festivals.id,
        set: {
          endDate: sql`COALESCE(${festivalValues.endDate}, ${festivals.endDate})`,
          countryCode: sql`COALESCE(${festivalValues.countryCode}, ${festivals.countryCode})`,
          countryName: sql`COALESCE(${festivalValues.countryName}, ${festivals.countryName})`,
          imageUrl: sql`COALESCE(${festivalValues.imageUrl}, ${festivals.imageUrl})`,
          latitude: sql`COALESCE(${festivalValues.latitude}, ${festivals.latitude})`,
          longitude: sql`COALESCE(${festivalValues.longitude}, ${festivals.longitude})`,
          sourceId: sql`COALESCE(${festivalValues.sourceId}, ${festivals.sourceId})`,
          interestedCount: sql`COALESCE(${festivalValues.interestedCount}, ${festivals.interestedCount})`,
          visitorsCount: sql`COALESCE(${festivalValues.visitorsCount}, ${festivals.visitorsCount})`,
        },
      });
  }

  if (parsed.lineup.length > 0) {
    const nameToId = await persistLineup(festivalId, parsed.lineup);

    if (parsed.timetable.length > 0) {
      await insertTimetableSlots(festivalId, parsed.timetable, nameToId, date);
    }
  }

  await syncFestivalGenres(festivalId, parsed.genres);

  return festivalId;
}

/**
 * Re-fetch a Partyflock event and replace our stored copy with the current
 * version — used by the scheduled refresh at the 7-day / 2-day checkpoints.
 * Deliberately not a Server Action (this file has no "use server" at all):
 * it deletes and re-persists a festival's lineup/timetable with no auth
 * check, so it must only be reachable from other server code
 * (festival-refresh-pf.ts), never directly from the client. Like
 * `importPFEvent` below.
 *
 * Fetch-first for safety: the page is parsed before anything is deleted, so a
 * failed or empty fetch leaves the existing lineup/timetable untouched. The
 * festival row is only ever upserted (never deleted), so user attendance and
 * ratings — which reference the festival/artist directly, not the lineup join —
 * are preserved.
 */
export async function refreshPFEvent(partyId: string): Promise<string | null> {
  if (!partyId || !/^\d+$/.test(partyId)) return null;
  const festivalId = `pf-${partyId}`;

  const parsed = await fetchAndParsePFEvent(partyId);
  // Only replace our stored copy when the fresh parse is actually complete. A
  // page that yields a name but no date or an empty lineup (parser drift, a
  // layout variant, or a lineup not yet announced) must NOT trigger the
  // destructive delete+reimport below — otherwise we would wipe a good lineup /
  // timetable or clobber the real date with today (persistPFEvent's date
  // fallback). Bailing here leaves the existing data untouched.
  if (!parsed?.name || !parsed.date || parsed.lineup.length === 0) return null;

  await clearPFFestivalRelations(festivalId);

  return persistPFEvent(festivalId, partyId, parsed, {
    force: true,
    skipNameDateDedupe: true,
  });
}

/**
 * Fetch a Partyflock event by party ID and persist it. Not a Server Action
 * (no directive, no auth, no rate limiting) — only safe to call from other
 * server code with its own request scope (scripts and the daily agenda cron).
 * Skips events that are already imported (unless `force`).
 */
export async function importPFEvent(
  partyId: string,
  opts?: { force?: boolean }
): Promise<string | null> {
  if (!partyId || !/^\d+$/.test(partyId)) return null;

  const festivalId = `pf-${partyId}`;

  // A merged-away id must resolve to its winner, never be recreated.
  const mergedInto = await resolveMergedFestivalId(festivalId);
  if (mergedInto) return mergedInto;

  if (!opts?.force) {
    const hasExisting = await checkExistingLineup(festivalId);
    if (hasExisting) {
      await backfillMissingImage(festivalId, () => fetchPFEventImageUrlCore(partyId));
      return festivalId;
    }
  }

  return importPFEventCore(partyId, festivalId, opts);
}
