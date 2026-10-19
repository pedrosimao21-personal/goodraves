"use server";

import { db } from "@/db";
import { and, desc, eq, sql } from "drizzle-orm";
import { artists, userArtistFollows, userFestivalArtistRatings } from "@/db/schema";
import { requireAuth } from "./festival-helpers";
import { toIsoDate } from "@/lib/dates";

const FOLLOW_SUGGESTIONS_LIMIT = 12;
// An artist qualifies once you've rated one of their sets this high, or seen
// them this many times (every row in user_festival_artist_ratings is a "seen").
const SUGGEST_MIN_RATING = 4;
const SUGGEST_MIN_TIMES_SEEN = 2;

export type FollowSuggestion = {
  artistId: string;
  name: string;
  imageUrl: string | null;
  timesSeen: number;
  bestRating: number | null;
  upcomingCount: number;
};

/**
 * Artists you've seen and liked but don't follow yet, so /following is useful
 * on day one. Ranked by best set rating, then times seen; artists with
 * upcoming festivals first within a tie, since following them pays off now.
 */
export async function getFollowSuggestions(): Promise<FollowSuggestion[]> {
  const userId = await requireAuth();
  const today = toIsoDate(new Date());

  const timesSeen = sql<number>`count(*)::int`;
  const bestRating = sql<number | null>`max(${userFestivalArtistRatings.rating})`;
  const upcomingCount = sql<number>`(
    SELECT count(*)::int FROM festival_artists fa
    JOIN festivals f ON f.id = fa.festival_id
    WHERE fa.artist_id = ${artists.id} AND coalesce(f.end_date, f.date) >= ${today}
  )`;

  return db
    .select({
      artistId: artists.id,
      name: artists.name,
      imageUrl: artists.imageUrl,
      timesSeen,
      bestRating,
      upcomingCount,
    })
    .from(userFestivalArtistRatings)
    .innerJoin(artists, eq(userFestivalArtistRatings.artistId, artists.id))
    .where(
      and(
        eq(userFestivalArtistRatings.userId, userId),
        sql`NOT EXISTS (
          SELECT 1 FROM ${userArtistFollows}
          WHERE ${userArtistFollows.userId} = ${userId} AND ${userArtistFollows.artistId} = ${artists.id}
        )`
      )
    )
    .groupBy(artists.id)
    .having(sql`${bestRating} >= ${SUGGEST_MIN_RATING} OR ${timesSeen} >= ${SUGGEST_MIN_TIMES_SEEN}`)
    .orderBy(sql`${bestRating} DESC NULLS LAST`, desc(timesSeen), desc(upcomingCount), artists.name)
    .limit(FOLLOW_SUGGESTIONS_LIMIT);
}
