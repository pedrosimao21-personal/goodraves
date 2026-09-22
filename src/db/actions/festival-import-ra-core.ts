import { db } from "@/db";
import { eq, inArray, sql } from "drizzle-orm";
import { artists, festivals, festivalArtists } from "@/db/schema";
import { checkExistingLineup, findExistingFestivalByNameDate, deleteB2bSets, backfillMissingImage, persistLineup } from "./festival-helpers";
import { resolveMergedFestivalId } from "./festival-merge-lookup";
import { fetchRAEventRaw } from "@/services/ra/client";
import { toIsoDate } from "@/lib/dates";
import { parseRALineup } from "@/services/ra/parser";
import { normalizeCountryName } from "@/utils/location-normalizer";
import { geocodeLocation } from "@/utils/geocoding";

/**
 * RA import internals shared by the "use server" actions in
 * festival-import-ra.ts and festival-data.ts's internal auto-import/backfill
 * path. Deliberately no "use server" — see festival-import-pf-core.ts's
 * top-of-file comment for why a plain shared file (not an inline directive)
 * is what actually keeps this off the client bundle.
 *
 * Also why festival-data.ts imports from here rather than the rate-limited
 * actions in festival-import-ra.ts: those call enforceRateLimit, which reads
 * headers() for the caller's IP — fine for a direct client-invoked action,
 * but festival-data.ts's getFestival() can run in the same server-rendered
 * request as festival-timetable.ts's unstable_cache call, and Next.js
 * disallows a dynamic API like headers() anywhere in a request that also
 * uses unstable_cache. The internal path doesn't need per-caller rate
 * limiting anyway — it's already bounded by the lineupCheckedAt/
 * imageCheckedAt recheck windows, which throttle per *festival*, not per
 * caller, but that's the right unit here since the id isn't attacker-chosen
 * the way a direct action call's id is.
 */

/** Fetch only the image URL for an RA event by numeric ID. No rate limiting
 * of its own — festival-import-ra.ts's exported action adds that before
 * calling in; internal callers (below, festival-data.ts) don't need it. */
export async function fetchRAEventImageUrlCore(raId: string): Promise<string | null> {
  const id = String(raId).replace(/\D/g, "");
  if (!id) return null;

  const data = await fetchRAEventRaw(id);
  if (!data) return null;

  return data.images?.[0]?.filename ?? null;
}

/** Fetch a single RA event by ID from ra.co and persist to DB. No rate
 * limiting or auth of its own — see the file comment above. */
export async function fetchRAEventCore(
  eventId: string,
  opts?: { force?: boolean }
): Promise<string | null> {
  const id = String(eventId).replace(/\D/g, "");
  if (!id) return null;

  const festivalId = `ra-${id}`;

  // A merged-away id must resolve to its winner, never be recreated.
  const mergedInto = await resolveMergedFestivalId(festivalId);
  if (mergedInto) return mergedInto;

  if (!opts?.force) {
    const hasExisting = await checkExistingLineup(festivalId);
    if (hasExisting) {
      await backfillMissingImage(festivalId, () => fetchRAEventImageUrlCore(id));
      return festivalId;
    }
  }

  const data = await fetchRAEventRaw(id);
  if (!data) return null;

  const date = data.startTime
    ? toIsoDate(new Date(data.startTime))
    : toIsoDate(new Date());
  const endDate = data.endTime
    ? toIsoDate(new Date(data.endTime))
    : null;

  const venueName = data.venue?.name ?? null;
  const rawAreaName = data.venue?.area?.name ?? null;
  const areaName = rawAreaName === "All" ? null : rawAreaName;
  const countryName = data.venue?.area?.country?.name
    ? normalizeCountryName(data.venue.area.country.name)
    : null;
  const location = [areaName, countryName].filter(Boolean).join(", ") || null;
  const imageUrl = data.images?.[0]?.filename ?? null;

  // Geocode the location to get coordinates for the heatmap. This is awaited
  // inline, so the import waits on it; failures are swallowed rather than
  // failing the import — the map falls back to a city-name lookup.
  const geocoded = location ? await geocodeLocation(location).catch(() => null) : null;

  const artistsFallback = (data.artists ?? [])
    .map((a) => a?.name)
    .filter(Boolean) as string[];
  const { entries: lineupEntries, raArtistIds } = parseRALineup(data.lineup, artistsFallback);

  const festivalName = data.title ?? `RA Event ${id}`;
  const existingId = await findExistingFestivalByNameDate(festivalName, date);
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

  const festivalValues = {
    id: festivalId,
    name: festivalName,
    date,
    endDate,
    venue: venueName,
    location,
    latitude: geocoded?.latitude ?? null,
    longitude: geocoded?.longitude ?? null,
    source: "ra" as const,
    sourceId: id,
    imageUrl,
    interestedCount: data.interestedCount ?? null,
    visitorsCount: data.attending ?? null,
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
          latitude: festivalValues.latitude,
          longitude: festivalValues.longitude,
          imageUrl: festivalValues.imageUrl,
          sourceId: festivalValues.sourceId,
          interestedCount: festivalValues.interestedCount,
          visitorsCount: festivalValues.visitorsCount,
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

  if (lineupEntries.length > 0) {
    await persistLineup(festivalId, lineupEntries);

    // Persist RA artist IDs for any entries that have them and are now in the DB.
    // Only update rows where ra_artist_id is currently null so we don't clobber
    // manually-corrected data.
    const namesWithRaId = Object.entries(raArtistIds)
      .filter(([, id]) => id !== null)
      .map(([name, id]) => ({ name, raArtistId: id! }));

    if (namesWithRaId.length > 0) {
      // Compare on lower(name) so this hits the case-insensitive unique index
      // rather than seq-scanning artists (there is no btree on the raw name).
      const lowerArtistNames = namesWithRaId.map((e) => e.name.toLowerCase());
      const existingRows = await db
        .select({ id: artists.id, name: artists.name, raArtistId: artists.raArtistId })
        .from(artists)
        .where(inArray(sql`lower(${artists.name})`, lowerArtistNames));

      const rowsToUpdate = existingRows
        .filter((row) => row.raArtistId === null)
        .map((row) => {
          // Matched case-insensitively to stay consistent with the query above:
          // RA's casing of a lineup name can differ from the stored casing.
          const entry = namesWithRaId.find(
            (e) => e.name.toLowerCase() === row.name.toLowerCase()
          );
          return entry ? { id: row.id, name: row.name, raArtistId: entry.raArtistId } : null;
        })
        .filter((r): r is { id: string; name: string; raArtistId: string } => r !== null);

      if (rowsToUpdate.length > 0) {
        // Single multi-row upsert keyed on id (conflict guaranteed — these ids
        // were just read from the DB).
        await db.insert(artists).values(rowsToUpdate).onConflictDoUpdate({
          target: artists.id,
          set: { raArtistId: sql`excluded.ra_artist_id` },
        });
      }
    }
  }

  return festivalId;
}
