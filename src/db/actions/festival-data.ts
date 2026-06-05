"use server";

import { db } from "@/db";
import { eq, sql, inArray } from "drizzle-orm";
import {
  festivals,
  festivalArtists,
  festivalTimetableSlots,
  artists,
  userFestivals,
  userFestivalArtistRatings,
  userArtistGlobal,
  genres,
  artistGenres as artistGenresTable,
} from "@/db/schema";
import { requireAuth } from "./festival-helpers";
import { fetchRAEvent, fetchRAEventImageUrl } from "./festival-import-ra";
import { fetchFFEvent, fetchFFEventImageUrl } from "./festival-import-ff";
import { fetchPFEvent, fetchPFEventImageUrl } from "./festival-import-pf";
import { resolvePFEventSlug } from "@/services/partyflock/client";

// ── Get a single festival with its lineup ──────────────

/** Query lineup for a given festival ID */
async function fetchLineup(festivalId: string) {
  return db
    .select({ artistId: festivalArtists.artistId, artistName: artists.name })
    .from(festivalArtists)
    .innerJoin(artists, eq(festivalArtists.artistId, artists.id))
    .where(eq(festivalArtists.festivalId, festivalId));
}

/** Format lineup rows into the response shape */
function formatFestivalWithLineup(
  festival: typeof festivals.$inferSelect,
  lineup: { artistId: string; artistName: string }[]
) {
  return {
    ...festival,
    lineup: lineup.map((r) => ({ id: r.artistId, name: r.artistName })),
  };
}

export async function getFestival(id: string) {
  let [festival] = await db
    .select()
    .from(festivals)
    .where(eq(festivals.id, id))
    .limit(1);

  if (!festival) {
    return await tryAutoImport(id);
  }

  let lineup = await fetchLineup(id);

  // If the festival has no lineup, re-fetch from the original source to populate.
  // After the re-fetch, re-read the festival row so we pick up any imageUrl or
  // coordinate updates that PF/FF imports write via COALESCE on conflict.
  if (lineup.length === 0) {
    const ffMatch = id.match(/^ff-([a-z0-9-]+)$/);
    const raMatch = id.match(/^ra-(\d+)$/);
    const pfMatch = id.match(/^pf-(\d+)$/);
    if (ffMatch) {
      await fetchFFEvent(ffMatch[1]);
      lineup = await fetchLineup(id);
    } else if (raMatch) {
      await fetchRAEvent(raMatch[1]);
      lineup = await fetchLineup(id);
    } else if (pfMatch) {
      await fetchPFEvent(pfMatch[1]);
      lineup = await fetchLineup(id);
    }

    // Re-read the festival row to capture any imageUrl / lat/lng written by the re-fetch
    const [refreshed] = await db
      .select()
      .from(festivals)
      .where(eq(festivals.id, id))
      .limit(1);
    if (refreshed) festival = refreshed;
  }

  // Backfill missing image from the original source
  if (!festival.imageUrl) {
    const ffMatch = id.match(/^ff-([a-z0-9-]+)$/);
    const raMatch = id.match(/^ra-(\d+)$/);
    const pfMatch = id.match(/^pf-(\d+)$/);
    let imageUrl: string | null = null;

    if (ffMatch) {
      imageUrl = await fetchFFEventImageUrl(ffMatch[1]);
    } else if (raMatch) {
      imageUrl = await fetchRAEventImageUrl(raMatch[1]);
    } else if (pfMatch) {
      imageUrl = await fetchPFEventImageUrl(pfMatch[1]);
    }

    if (imageUrl) {
      await db
        .update(festivals)
        .set({ imageUrl })
        .where(eq(festivals.id, id));
      festival.imageUrl = imageUrl;
    }
  }

  return formatFestivalWithLineup(festival, lineup);
}

/** Auto-import from RA or FestivalFans if the ID matches their patterns */
async function tryAutoImport(id: string) {
  const raMatch = id.match(/^ra-(\d+)$/);
  if (raMatch) {
    return await importAndReturn(id, () => fetchRAEvent(raMatch[1]));
  }

  const ffMatch = id.match(/^ff-([a-z0-9-]+)$/);
  if (ffMatch) {
    return await importAndReturn(id, () => fetchFFEvent(ffMatch[1]));
  }

  const pfMatch = id.match(/^pf-(\d+)$/);
  if (pfMatch) {
    return await importAndReturn(id, () => fetchPFEvent(pfMatch[1]));
  }

  // Partyflock permanent series URLs (/event/slug) can't be fetched directly;
  // resolve the slug to the underlying numeric party ID first.
  const pfEventMatch = id.match(/^pf-event-([a-z0-9-]+)$/);
  if (pfEventMatch) {
    const partyId = await resolvePFEventSlug(pfEventMatch[1]);
    if (!partyId) return null;
    return await importAndReturn(`pf-${partyId}`, () => fetchPFEvent(partyId));
  }

  return null;
}

/** Import an event and return it with lineup, or null on failure */
async function importAndReturn(
  festivalId: string,
  importFn: () => Promise<string | null>
) {
  const imported = await importFn();
  if (!imported) return null;

  const [importedFestival] = await db
    .select()
    .from(festivals)
    .where(eq(festivals.id, festivalId))
    .limit(1);
  if (!importedFestival) return null;

  const lineup = await fetchLineup(festivalId);
  return formatFestivalWithLineup(importedFestival, lineup);
}

// ── Get all user data (full state load) ────────────────
export async function getFullUserData() {
  const userId = await requireAuth();

  const [userFestivalsData, artistRatingsData, globalArtistData] = await Promise.all([
    db
      .select({
        festivalId: userFestivals.festivalId,
        rating: userFestivals.rating,
        notes: userFestivals.notes,
        name: festivals.name,
        date: festivals.date,
        venue: festivals.venue,
        location: festivals.location,
        latitude: festivals.latitude,
        longitude: festivals.longitude,
        imageUrl: festivals.imageUrl,
        source: festivals.source,
      })
      .from(userFestivals)
      .innerJoin(festivals, eq(userFestivals.festivalId, festivals.id))
      .where(eq(userFestivals.userId, userId)),
    db
      .select()
      .from(userFestivalArtistRatings)
      .where(eq(userFestivalArtistRatings.userId, userId)),
    db
      .select()
      .from(userArtistGlobal)
      .where(eq(userArtistGlobal.userId, userId)),
  ]);

  const festivalIds = userFestivalsData.map((f) => f.festivalId);
  let lineups: { festivalId: string; artistId: string; artistName: string }[] = [];
  if (festivalIds.length > 0) {
    lineups = await db
      .select({
        festivalId: festivalArtists.festivalId,
        artistId: festivalArtists.artistId,
        artistName: artists.name,
      })
      .from(festivalArtists)
      .innerJoin(artists, eq(festivalArtists.artistId, artists.id))
      .where(sql`${festivalArtists.festivalId} IN ${festivalIds}`);
  }

  const seenArtistIds = [...new Set(artistRatingsData.map((ar) => ar.artistId))];
  const artistGenreData = await fetchArtistGenreData(seenArtistIds);

  return {
    festivals: userFestivalsData,
    artistRatings: artistRatingsData,
    globalArtistData,
    lineups,
    artistGenres: artistGenreData,
  };
}

/** Fetch genre data for a list of artist IDs */
async function fetchArtistGenreData(artistIds: string[]) {
  if (artistIds.length === 0) return [];

  const rows = await db
    .select({ id: artists.id, name: artists.name })
    .from(artists)
    .where(inArray(artists.id, artistIds));

  const genreRows = await db
    .select({ artistId: artistGenresTable.artistId, genreName: genres.name })
    .from(artistGenresTable)
    .innerJoin(genres, eq(artistGenresTable.genreId, genres.id))
    .where(inArray(artistGenresTable.artistId, artistIds));

  const genresByArtist = new Map<string, string[]>();
  for (const row of genreRows) {
    const list = genresByArtist.get(row.artistId) ?? [];
    list.push(row.genreName);
    genresByArtist.set(row.artistId, list);
  }

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    genres: genresByArtist.get(r.id) ?? [],
  }));
}

// ── Timetable ──────────────────────────────────────────

export type TimetableStage = {
  stageName: string;
  stageOrder: number;
  slots: TimetableSlotRow[];
};

export type TimetableSlotRow = {
  artistId: string;
  artistName: string;
  startTime: string;
  endTime: string;
  slotOrder: number;
};

/**
 * Fetch all timetable slots for a festival, grouped by stage.
 * Returns an empty array when no timetable data exists.
 */
export async function getTimetable(festivalId: string): Promise<TimetableStage[]> {
  const rows = await db
    .select({
      stageName: festivalTimetableSlots.stageName,
      stageOrder: festivalTimetableSlots.stageOrder,
      slotOrder: festivalTimetableSlots.slotOrder,
      startTime: festivalTimetableSlots.startTime,
      endTime: festivalTimetableSlots.endTime,
      artistId: artists.id,
      artistName: artists.name,
    })
    .from(festivalTimetableSlots)
    .innerJoin(artists, eq(festivalTimetableSlots.artistId, artists.id))
    .where(eq(festivalTimetableSlots.festivalId, festivalId))
    .orderBy(festivalTimetableSlots.stageOrder, festivalTimetableSlots.slotOrder);

  const stageMap = new Map<number, TimetableStage>();

  for (const row of rows) {
    let stage = stageMap.get(row.stageOrder);
    if (!stage) {
      stage = { stageName: row.stageName, stageOrder: row.stageOrder, slots: [] };
      stageMap.set(row.stageOrder, stage);
    }
    stage.slots.push({
      artistId: row.artistId,
      artistName: row.artistName,
      startTime: row.startTime,
      endTime: row.endTime,
      slotOrder: row.slotOrder,
    });
  }

  return Array.from(stageMap.values()).sort((a, b) => a.stageOrder - b.stageOrder);
}
