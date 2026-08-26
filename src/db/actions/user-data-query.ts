/**
 * Shared query for loading a user's full data (attendance, ratings, notes).
 *
 * This is a plain server-only module — deliberately NOT `"use server"`. It takes
 * an arbitrary userId, so exposing it as a Server Action would be an IDOR:
 * anyone could read any user's private data by guessing a UUID. Callers must
 * derive the userId from the session themselves: `getFullUserData`
 * (festival-data.ts) via requireAuth, and the root layout (app/layout.tsx) from
 * the single `auth()` call it already makes for the session provider.
 */

import { db } from "@/db";
import { eq, inArray } from "drizzle-orm";
import {
  festivals,
  artists,
  userFestivals,
  userFestivalArtistRatings,
  userArtistGlobal,
  userArtistWantToSee,
  genres,
  artistGenres as artistGenresTable,
} from "@/db/schema";
import { fetchFestivalGenresByIds } from "./festival-genres";

/**
 * SSR hydration payload for UserDataContext. Null when there is no session —
 * the root layout passes null for logged-out visitors rather than querying.
 */
export type InitialUserData = Awaited<ReturnType<typeof fetchUserDataForId>> | null;

/** Shared query logic for fetching all user data given a userId. */
export async function fetchUserDataForId(userId: string) {
  const [userFestivalsData, artistRatingsData, globalArtistData, wantToSeeData] =
    await Promise.all([
      db
        .select({
          festivalId: userFestivals.festivalId,
          rating: userFestivals.rating,
          notes: userFestivals.notes,
          publicComment: userFestivals.publicComment,
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
      db
        .select({
          festivalId: userArtistWantToSee.festivalId,
          artistId: userArtistWantToSee.artistId,
        })
        .from(userArtistWantToSee)
        .where(eq(userArtistWantToSee.userId, userId)),
    ]);

  const seenArtistIds = [...new Set(artistRatingsData.map((ar) => ar.artistId))];
  const [artistGenreData, festivalGenresById] = await Promise.all([
    fetchArtistGenreData(seenArtistIds),
    fetchFestivalGenresByIds(userFestivalsData.map((f) => f.festivalId)),
  ]);

  const festivalsWithGenres = userFestivalsData.map((f) => ({
    ...f,
    genres: festivalGenresById.get(f.festivalId) ?? [],
  }));

  return {
    festivals: festivalsWithGenres,
    artistRatings: artistRatingsData,
    globalArtistData,
    artistGenres: artistGenreData,
    wantToSee: wantToSeeData,
  };
}

/** Fetch genre data for a list of artist IDs. */
async function fetchArtistGenreData(artistIds: string[]) {
  if (artistIds.length === 0) return [];

  const [rows, genreRows] = await Promise.all([
    db
      .select({ id: artists.id, name: artists.name })
      .from(artists)
      .where(inArray(artists.id, artistIds)),
    db
      .select({ artistId: artistGenresTable.artistId, genreName: genres.name })
      .from(artistGenresTable)
      .innerJoin(genres, eq(artistGenresTable.genreId, genres.id))
      .where(inArray(artistGenresTable.artistId, artistIds)),
  ]);

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
