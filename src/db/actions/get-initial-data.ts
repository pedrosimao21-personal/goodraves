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
  let lineups: { festivalId: string; artistName: string }[] = [];
  if (festivalIds.length > 0) {
    lineups = await db
      .select({
        festivalId: festivalArtists.festivalId,
        artistName: festivalArtists.artistName,
      })
      .from(festivalArtists)
      .where(sql`${festivalArtists.festivalId} IN ${festivalIds}`);
  }

  // Fetch genres for all artists the user has seen
  const seenArtistNames = [...new Set(artistRatingsData.map((ar) => ar.artistName))];
  let artistGenres: { name: string; genres: string | null }[] = [];
  if (seenArtistNames.length > 0) {
    artistGenres = await db
      .select({ name: artists.name, genres: artists.genres })
      .from(artists)
      .where(inArray(artists.name, seenArtistNames));
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
