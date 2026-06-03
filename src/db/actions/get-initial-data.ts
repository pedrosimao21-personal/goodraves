"use server";

import { db } from "@/db";
import { eq, sql, inArray } from "drizzle-orm";
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

/**
 * Fetches all user data server-side for SSR hydration.
 * Returns null if not authenticated.
 */
export async function getInitialUserData() {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return null;

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

  // Fetch tags for all artists the user has seen
  const seenArtistIds = [...new Set(artistRatingsData.map((ar) => ar.artistId))];
  let artistGenreData: { id: string; name: string; genres: string[] }[] = [];
  if (seenArtistIds.length > 0) {
    const rows = await db
      .select({ id: artists.id, name: artists.name })
      .from(artists)
      .where(inArray(artists.id, seenArtistIds));

    // Fetch genre names for these artists in a separate query
    const genreRows = await db
      .select({ artistId: artistGenresTable.artistId, genreName: genres.name })
      .from(artistGenresTable)
      .innerJoin(genres, eq(artistGenresTable.genreId, genres.id))
      .where(inArray(artistGenresTable.artistId, seenArtistIds));

    const genresByArtist = new Map<string, string[]>();
    for (const row of genreRows) {
      const list = genresByArtist.get(row.artistId) ?? [];
      list.push(row.genreName);
      genresByArtist.set(row.artistId, list);
    }

    artistGenreData = rows.map(r => ({
      id: r.id,
      name: r.name,
      genres: genresByArtist.get(r.id) ?? [],
    }));
  }

  return {
    festivals: userFestivalsData,
    artistRatings: artistRatingsData,
    globalArtistData,
    lineups,
    artistGenres: artistGenreData,
  };
}

export type InitialUserData = Awaited<ReturnType<typeof getInitialUserData>>;
