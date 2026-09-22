import { db } from "@/db";
import { eq, sql } from "drizzle-orm";
import { festivals, festivalArtists } from "@/db/schema";
import { checkExistingLineup, findExistingFestivalByNameDate, deleteB2bSets, backfillMissingImage, persistLineup } from "./festival-helpers";
import { resolveMergedFestivalId } from "./festival-merge-lookup";
import { fetchFFEventHtml } from "@/services/festivalfans/client";
import { toIsoDate } from "@/lib/dates";
import { parseFFEventPage } from "@/services/festivalfans/parser";

/**
 * FestivalFans import internals shared by the "use server" actions in
 * festival-import-ff.ts and festival-data.ts's internal auto-import/backfill
 * path. Deliberately no "use server" — see festival-import-pf-core.ts's and
 * festival-import-ra-core.ts's file comments for why this needs to be a
 * plain shared file, not just an internal implementation detail.
 */

/** Fetch only the og:image URL for a FestivalFans.nl event by slug. No rate
 * limiting of its own — festival-import-ff.ts's exported action adds that
 * before calling in; internal callers (below, festival-data.ts) don't need it. */
export async function fetchFFEventImageUrlCore(slug: string): Promise<string | null> {
  if (!slug || !/^[a-z0-9-]+$/i.test(slug)) return null;

  const html = await fetchFFEventHtml(slug);
  if (!html) return null;

  const parsed = parseFFEventPage(html);
  return parsed.imageUrl;
}

/** Fetch a single FestivalFans.nl event by slug and persist to DB. No rate
 * limiting or auth of its own — see the file comment above. */
export async function fetchFFEventCore(
  slug: string,
  opts?: { force?: boolean }
): Promise<string | null> {
  if (!slug || !/^[a-z0-9-]+$/i.test(slug)) return null;

  const festivalId = `ff-${slug}`;

  // A merged-away id must resolve to its winner, never be recreated.
  const mergedInto = await resolveMergedFestivalId(festivalId);
  if (mergedInto) return mergedInto;

  if (!opts?.force) {
    const hasExisting = await checkExistingLineup(festivalId);
    if (hasExisting) {
      await backfillMissingImage(festivalId, () => fetchFFEventImageUrlCore(slug));
      return festivalId;
    }
  }

  const html = await fetchFFEventHtml(slug);
  if (!html) return null;

  const parsed = parseFFEventPage(html);
  if (!parsed.name) return null;

  const date = parsed.date ?? toIsoDate(new Date());

  const existingId = await findExistingFestivalByNameDate(parsed.name, date);
  if (existingId && existingId !== festivalId) {
    return existingId;
  }

  // On a forced re-import, rebuild the lineup from scratch so dropped artists are
  // removed and B2B sets aren't duplicated. Runs only after a successful fetch and
  // once committed to this festival id. Ratings/attendance survive (they key on
  // (userId, festivalId, artistId), not the lineup join).
  if (opts?.force) {
    await deleteB2bSets(festivalId);
    await db.delete(festivalArtists).where(eq(festivalArtists.festivalId, festivalId));
  }

  // FestivalFans is Netherlands-only — parseFFEventPage already hardcodes
  // "Netherlands" onto `location` when there's a city, so mirror that here
  // rather than re-deriving it from the joined string.
  const countryName = parsed.location ? "Netherlands" : null;
  const countryCode = parsed.location ? "NL" : null;

  const festivalValues = {
    id: festivalId,
    name: parsed.name,
    date,
    endDate: parsed.endDate,
    venue: parsed.venue,
    location: parsed.location,
    countryCode,
    countryName,
    source: "festivalfans" as const,
    sourceId: slug,
    imageUrl: parsed.imageUrl,
    latitude: parsed.latitude,
    longitude: parsed.longitude,
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
        },
      });
  }

  await persistLineup(festivalId, parsed.lineup);

  return festivalId;
}
