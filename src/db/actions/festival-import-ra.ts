"use server";

import { db } from "@/db";
import { eq, inArray, sql } from "drizzle-orm";
import { artists, festivals, festivalArtists } from "@/db/schema";
import { requireAdmin, enforceRateLimit, checkExistingLineup, findExistingFestivalByNameDate, deleteB2bSets, backfillMissingImage, persistLineup } from "./festival-helpers";
import { RATE_LIMIT_IMPORT_MAX, RATE_LIMIT_WINDOW_MS } from "@/lib/constants";
import { fetchRAEventRaw } from "@/services/ra/client";
import { toIsoDate } from "@/lib/dates";
import { parseRALineup } from "@/services/ra/parser";
import { normalizeCountryName } from "@/utils/location-normalizer";
import { geocodeLocation } from "@/utils/geocoding";

/** Fetch only the image URL for an RA event by numeric ID. */
export async function fetchRAEventImageUrl(raId: string): Promise<string | null> {
  const id = String(raId).replace(/\D/g, "");
  if (!id) return null;

  const data = await fetchRAEventRaw(id);
  if (!data) return null;

  return data.images?.[0]?.filename ?? null;
}

/** Force-reimport an RA event (deletes existing lineup first) */
export async function reimportRAEvent(eventId: string): Promise<string | null> {
  await requireAdmin();
  const id = String(eventId).replace(/\D/g, "");
  if (!id) return null;
  const festivalId = `ra-${id}`;

  await deleteB2bSets(festivalId);

  await db
    .delete(festivalArtists)
    .where(eq(festivalArtists.festivalId, festivalId));

  return fetchRAEvent(eventId, { force: true });
}

/** Fetch a single RA event by ID from ra.co and persist to DB */
export async function fetchRAEvent(
  eventId: string,
  opts?: { force?: boolean }
): Promise<string | null> {
  const id = String(eventId).replace(/\D/g, "");
  if (!id) return null;

  const festivalId = `ra-${id}`;

  if (!opts?.force) {
    const hasExisting = await checkExistingLineup(festivalId);
    if (hasExisting) {
      await backfillMissingImage(festivalId, () => fetchRAEventImageUrl(id));
      return festivalId;
    }
  }

  // Past this point we hit ra.co and write a new festival — rate-limit imports.
  await enforceRateLimit("import", RATE_LIMIT_IMPORT_MAX, RATE_LIMIT_WINDOW_MS);

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

  // Geocode the location to get coordinates for the heatmap.
  // We do this in the background alongside the rest of the import;
  // failures are silently ignored — the map will fall back to city-name lookup.
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
      const artistNames = namesWithRaId.map((e) => e.name);
      const existingRows = await db
        .select({ id: artists.id, name: artists.name, raArtistId: artists.raArtistId })
        .from(artists)
        .where(inArray(artists.name, artistNames));

      await Promise.allSettled(
        existingRows
          .filter((row) => row.raArtistId === null)
          .map((row) => {
            const entry = namesWithRaId.find((e) => e.name === row.name);
            if (!entry) return Promise.resolve();
            return db
              .update(artists)
              .set({ raArtistId: entry.raArtistId })
              .where(eq(artists.id, row.id));
          })
      );
    }
  }

  return festivalId;
}
