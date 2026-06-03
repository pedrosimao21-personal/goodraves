"use server";

import { db } from "@/db";
import { eq, inArray } from "drizzle-orm";
import { artists, festivals, festivalArtists } from "@/db/schema";
import { ensureArtistsAndGetIds, checkExistingLineup, findExistingFestivalByNameDate, createB2bSets, deleteB2bSets } from "./festival-helpers";
import { fetchRAEventRaw } from "@/services/ra/client";
import { parseRALineup } from "@/services/ra/parser";
import { flattenLineupNames, filterB2bEntries } from "@/services/lineup-types";
import { normalizeCountryName } from "@/utils/location-normalizer";
import { geocodeLocation } from "@/utils/geocoding";

/** Fetch and store imageUrl for an RA event that was imported without one. */
async function backfillMissingImage(festivalId: string, raId: string): Promise<void> {
  const [row] = await db
    .select({ imageUrl: festivals.imageUrl })
    .from(festivals)
    .where(eq(festivals.id, festivalId))
    .limit(1);

  if (row?.imageUrl) return;

  const imageUrl = await fetchRAEventImageUrl(raId);
  if (!imageUrl) return;

  await db
    .update(festivals)
    .set({ imageUrl })
    .where(eq(festivals.id, festivalId));
}

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
      await backfillMissingImage(festivalId, id);
      return festivalId;
    }
  }

  const data = await fetchRAEventRaw(id);
  if (!data) return null;

  const date = data.startTime
    ? new Date(data.startTime).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  const endDate = data.endTime
    ? new Date(data.endTime).toISOString().slice(0, 10)
    : null;

  const venueName = data.venue?.name ?? null;
  const areaName = data.venue?.area?.name ?? null;
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
  const lineup = flattenLineupNames(lineupEntries);

  const festivalName = data.title ?? `RA Event ${id}`;
  const existingId = await findExistingFestivalByNameDate(festivalName, date);
  if (existingId && existingId !== festivalId) {
    return existingId;
  }

  await db
    .insert(festivals)
    .values({
      id: festivalId,
      name: festivalName,
      date,
      endDate,
      venue: venueName,
      location,
      latitude: geocoded?.latitude ?? null,
      longitude: geocoded?.longitude ?? null,
      source: "ra",
      sourceId: id,
      imageUrl,
      interestedCount: (data.interestedCount ?? 0) + (data.attending ?? 0),
    })
    .onConflictDoNothing();

  if (lineup.length > 0) {
    const nameToId = await ensureArtistsAndGetIds(lineup);

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

    await db
      .insert(festivalArtists)
      .values(
        lineup
          .filter((name) => nameToId[name])
          .map((name) => ({ festivalId, artistId: nameToId[name] }))
      )
      .onConflictDoNothing();

    const b2bEntries = filterB2bEntries(lineupEntries);
    if (b2bEntries.length > 0) {
      await createB2bSets(festivalId, b2bEntries, nameToId);
    }
  }

  return festivalId;
}
