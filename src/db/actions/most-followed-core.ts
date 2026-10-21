/** Query behind getMostFollowedArtists (most-followed-artists.ts). */

import { db } from "@/db";
import { artists, festivalArtists, festivals, userArtistFollows } from "@/db/schema";
import { and, desc, eq, inArray, sql } from "drizzle-orm";

const LIST_LIMIT = 6;

export type MostFollowedArtist = {
  artistId: string;
  name: string;
  imageUrl: string | null;
  followerCount: number;
  upcomingCount: number;
};

/**
 * The artists most people follow, with how many upcoming festivals in our
 * lineups each has. Counts only, never who follows (follows are friends-only).
 * Uncached; most-followed-artists.ts caches it.
 */
export async function queryMostFollowed(today: string): Promise<MostFollowedArtist[]> {
  const followerCount = sql<number>`count(*)::int`;
  const top = await db
    .select({ artistId: artists.id, name: artists.name, imageUrl: artists.imageUrl, followerCount })
    .from(userArtistFollows)
    .innerJoin(artists, eq(artists.id, userArtistFollows.artistId))
    .groupBy(artists.id, artists.name, artists.imageUrl)
    .orderBy(desc(followerCount), artists.name)
    .limit(LIST_LIMIT);
  if (top.length === 0) return [];

  const upcoming = await db
    .select({ artistId: festivalArtists.artistId, count: sql<number>`count(distinct ${festivals.id})::int` })
    .from(festivalArtists)
    .innerJoin(festivals, eq(festivals.id, festivalArtists.festivalId))
    .where(and(
      inArray(festivalArtists.artistId, top.map((row) => row.artistId)),
      sql`COALESCE(${festivals.endDate}, ${festivals.date}) >= ${today}`,
    ))
    .groupBy(festivalArtists.artistId);
  const upcomingById = new Map(upcoming.map((row) => [row.artistId, row.count]));

  return top.map((row) => ({ ...row, upcomingCount: upcomingById.get(row.artistId) ?? 0 }));
}

