"use server";

import { db } from "@/db";
import { eq, sql } from "drizzle-orm";
import { userArtistFollows } from "@/db/schema";
import { getOptionalUserId } from "./festival-helpers";
import { fetchAcceptedFriendIds } from "./friend-ids";
import { fetchFriendsFollowingByArtist } from "./follow-friend-lookups";
import { fetchArtistTimetableSlots, fetchUpcomingLineupRows } from "./artist-upcoming-festivals";
import type { GigSet } from "./following-gig-builder";
import { isUuid } from "@/lib/uuid";

const ARTIST_UPCOMING_FESTIVALS_LIMIT = 20;

export type ArtistUpcomingFestival = {
  festivalId: string;
  name: string;
  date: string;
  endDate: string | null;
  location: string | null;
  venue: string | null;
  sets: GigSet[];
};

export type ArtistFollowContext = {
  followerCount: number;
  friendsFollowing: string[];
  upcomingFestivals: ArtistUpcomingFestival[];
};

const EMPTY_CONTEXT: ArtistFollowContext = { followerCount: 0, friendsFollowing: [], upcomingFestivals: [] };

async function fetchFollowerCount(artistId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(userArtistFollows)
    .where(eq(userArtistFollows.artistId, artistId));
  return row?.count ?? 0;
}

async function fetchFriendsFollowing(userId: string | null, artistId: string): Promise<string[]> {
  if (!userId) return [];
  const friendIds = await fetchAcceptedFriendIds(userId);
  const byArtist = await fetchFriendsFollowingByArtist(friendIds, [artistId]);
  return byArtist.get(artistId) ?? [];
}

async function fetchUpcomingFestivals(artistId: string): Promise<ArtistUpcomingFestival[]> {
  const rows = await fetchUpcomingLineupRows([artistId], ARTIST_UPCOMING_FESTIVALS_LIMIT);
  const slots = await fetchArtistTimetableSlots(rows.map((r) => r.festivalId), [artistId]);
  return rows.map((row) => ({
    festivalId: row.festivalId,
    name: row.name,
    date: row.date,
    endDate: row.endDate,
    location: row.location,
    venue: row.venue,
    sets: slots
      .filter((slot) => slot.festivalId === row.festivalId)
      .map(({ slotDate, stageName, startTime, endTime }) => ({ slotDate, stageName, startTime, endTime })),
  }));
}

/**
 * Follow-related data for the artist page: upcoming festivals on Goodraves
 * (public), follower count (public, a number only), and which of your friends
 * follow this artist (only when logged in; follows are visible to friends,
 * never as a public list).
 */
export async function getArtistFollowContext(artistId: string): Promise<ArtistFollowContext> {
  if (!isUuid(artistId)) return EMPTY_CONTEXT;
  const userId = await getOptionalUserId();

  const [followerCount, friendsFollowing, upcomingFestivals] = await Promise.all([
    fetchFollowerCount(artistId),
    fetchFriendsFollowing(userId, artistId),
    fetchUpcomingFestivals(artistId),
  ]);
  return { followerCount, friendsFollowing, upcomingFestivals };
}
