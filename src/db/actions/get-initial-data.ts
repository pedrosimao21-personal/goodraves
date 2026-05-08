"use server";

import { db } from "@/db";
import { eq, sql, inArray } from "drizzle-orm";
import {
  festivals,
  festivalArtists,
  artists,
  userFestivals,
  userArtistRatings,
  userArtistGlobal,
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
          status: userFestivals.status,
          rating: userFestivals.rating,
          notes: userFestivals.notes,
          name: festivals.name,
          date: festivals.date,
          venue: festivals.venue,
          location: festivals.location,
          imageUrl: festivals.imageUrl,
          source: festivals.source,
        })
        .from(userFestivals)
        .innerJoin(festivals, eq(userFestivals.festivalId, festivals.id))
        .where(eq(userFestivals.userId, userId)),
      db
        .select()
        .from(userArtistRatings)
        .where(eq(userArtistRatings.userId, userId)),
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
  let artistGenres: { id: string; name: string; genres: string | null }[] = [];
  if (seenArtistIds.length > 0) {
    artistGenres = await db
      .select({ id: artists.id, name: artists.name, genres: artists.lastfmTags })
      .from(artists)
      .where(inArray(artists.id, seenArtistIds));
  }

  return {
    festivals: userFestivalsData,
    artistRatings: artistRatingsData,
    globalArtistData,
    lineups,
    artistGenres,
  };
}

export type InitialUserData = Awaited<ReturnType<typeof getInitialUserData>>;
