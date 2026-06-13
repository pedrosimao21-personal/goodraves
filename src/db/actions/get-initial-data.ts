"use server";

import { db } from "@/db";
import { eq, inArray } from "drizzle-orm";
import {
  festivals,
  festivalArtists,
  artists,
  userFestivals,
  userFestivalArtistRatings,
  userArtistGlobal,
  genres,
  artistGenres as artistGenresTable,
} from "@/db/schema";
import { auth } from "../../../auth";

/** Shared query logic for fetching all user data given a userId */
export async function fetchUserDataForId(userId: string) {
  const [userFestivalsData, artistRatingsData, globalArtistData] =
    await Promise.all([
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
        .select({
          userId: userFestivalArtistRatings.userId,
          festivalId: userFestivalArtistRatings.festivalId,
          artistId: userFestivalArtistRatings.artistId,
          rating: userFestivalArtistRatings.rating,
        })
        .from(userFestivalArtistRatings)
        .where(eq(userFestivalArtistRatings.userId, userId)),
      db
        .select({
          userId: userArtistGlobal.userId,
          artistId: userArtistGlobal.artistId,
          rating: userArtistGlobal.rating,
          notes: userArtistGlobal.notes,
        })
        .from(userArtistGlobal)
        .where(eq(userArtistGlobal.userId, userId)),
    ]);

  const seenArtistIds = [...new Set(artistRatingsData.map((ar) => ar.artistId))];
  const artistGenreData = await fetchArtistGenreData(seenArtistIds);

  return {
    festivals: userFestivalsData,
    artistRatings: artistRatingsData,
    globalArtistData,
    artistGenres: artistGenreData,
  };
}

/** Fetch lineup artist names for a single festival (on-demand) */
export async function getFestivalLineupNames(festivalId: string): Promise<string[]> {
  const rows = await db
    .select({ artistName: artists.name })
    .from(festivalArtists)
    .innerJoin(artists, eq(festivalArtists.artistId, artists.id))
    .where(eq(festivalArtists.festivalId, festivalId));

  return rows.map((r) => r.artistName);
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

/**
 * Fetches all user data server-side for SSR hydration.
 * Returns null if not authenticated.
 */
export async function getInitialUserData() {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return null;

  return fetchUserDataForId(userId);
}

export type InitialUserData = Awaited<ReturnType<typeof getInitialUserData>>;
