"use server";

import { db } from "@/db";
import { eq, sql } from "drizzle-orm";
import { festivals, festivalArtists, festivalTimetableSlots } from "@/db/schema";
import { requireAdmin, enforceRateLimit, checkExistingLineup, findExistingFestivalByNameDate, deleteB2bSets, backfillMissingImage, persistLineup } from "./festival-helpers";
import { RATE_LIMIT_IMPORT_MAX, RATE_LIMIT_WINDOW_MS } from "@/lib/constants";
import { fetchPFEventHtml } from "@/services/partyflock/client";
import { toIsoDate } from "@/lib/dates";
import { parsePFEventPage } from "@/services/partyflock/parser";
import { type TimetableSlot } from "@/services/lineup-types";

/** Insert timetable slots for a festival, mapping artist names to IDs. */
async function insertTimetableSlots(
  festivalId: string,
  slots: TimetableSlot[],
  nameToId: Record<string, string>
): Promise<void> {
  const rows = slots
    .filter((slot) => nameToId[slot.artistName])
    .map((slot) => ({
      festivalId,
      artistId: nameToId[slot.artistName],
      stageName: slot.stageName,
      startTime: slot.startTime,
      endTime: slot.endTime,
      stageOrder: slot.stageOrder,
      slotOrder: slot.slotOrder,
    }));

  if (rows.length === 0) return;

  await db
    .insert(festivalTimetableSlots)
    .values(rows)
    .onConflictDoNothing();
}

/** Fetch only the og:image URL for a Partyflock event by party ID. */
export async function fetchPFEventImageUrl(partyId: string): Promise<string | null> {
  if (!partyId || !/^\d+$/.test(partyId)) return null;

  const html = await fetchPFEventHtml(partyId);
  if (!html) return null;

  const parsed = parsePFEventPage(html);
  return parsed.imageUrl;
}

/** Delete a festival's lineup, B2B sets, and timetable (leaves the festival row intact). */
async function clearPFFestivalRelations(festivalId: string): Promise<void> {
  await deleteB2bSets(festivalId);

  await db
    .delete(festivalArtists)
    .where(eq(festivalArtists.festivalId, festivalId));

  await db
    .delete(festivalTimetableSlots)
    .where(eq(festivalTimetableSlots.festivalId, festivalId));
}

/** Force-reimport a Partyflock event (deletes existing lineup first). */
export async function reimportPFEvent(partyId: string): Promise<string | null> {
  await requireAdmin();
  if (!partyId) return null;
  const festivalId = `pf-${partyId}`;

  await clearPFFestivalRelations(festivalId);

  return fetchPFEvent(partyId, { force: true });
}

/**
 * Re-fetch a Partyflock event and replace our stored copy with the current
 * version — used by the scheduled refresh at the 7-day / 2-day checkpoints.
 * Context-free (no auth, no rate limit) like `importPFEvent`.
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
 * Fetch a Partyflock event by party ID and persist it. Context-free: no auth,
 * no rate limiting, no request scope — safe to call from scripts and cron jobs.
 * Skips events that are already imported (unless `force`).
 */
export async function importPFEvent(
  partyId: string,
  opts?: { force?: boolean }
): Promise<string | null> {
  if (!partyId || !/^\d+$/.test(partyId)) return null;

  const festivalId = `pf-${partyId}`;

  if (!opts?.force) {
    const hasExisting = await checkExistingLineup(festivalId);
    if (hasExisting) {
      await backfillMissingImage(festivalId, () => fetchPFEventImageUrl(partyId));
      return festivalId;
    }
  }

  return importPFEventCore(partyId, festivalId, opts);
}

/**
 * Fetch a single Partyflock event by party ID and persist to DB. Server-action
 * entry point: rate-limited per caller. Internal callers (scripts/cron) should
 * use `importPFEvent` instead to avoid the request-scoped rate limit.
 */
export async function fetchPFEvent(
  partyId: string,
  opts?: { force?: boolean }
): Promise<string | null> {
  if (!partyId || !/^\d+$/.test(partyId)) return null;

  const festivalId = `pf-${partyId}`;

  if (!opts?.force) {
    const hasExisting = await checkExistingLineup(festivalId);
    if (hasExisting) {
      await backfillMissingImage(festivalId, () => fetchPFEventImageUrl(partyId));
      return festivalId;
    }
  }

  // Past this point we hit partyflock.nl and write a new festival.
  await enforceRateLimit("import", RATE_LIMIT_IMPORT_MAX, RATE_LIMIT_WINDOW_MS);

  return importPFEventCore(partyId, festivalId, opts);
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
async function importPFEventCore(
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

  const festivalValues = {
    id: festivalId,
    name: parsed.name,
    date,
    endDate: parsed.endDate,
    venue: parsed.venue,
    location: parsed.location,
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
      await insertTimetableSlots(festivalId, parsed.timetable, nameToId);
    }
  }

  return festivalId;
}
