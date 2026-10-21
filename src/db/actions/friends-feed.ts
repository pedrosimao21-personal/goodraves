"use server";

import { db } from "@/db";
import { and, desc, eq, inArray, lt, sql } from "drizzle-orm";
import { artists, festivals, userArtistFollows, userFestivalArtistRatings, userFestivals, users } from "@/db/schema";
import { requireAuth } from "./festival-helpers";
import { fetchAcceptedFriendIds } from "./friend-ids";

const FEED_PAGE_SIZE = 20;

export type FestivalFeedItem = {
  kind: "festival";
  userId: string;
  username: string;
  festivalId: string;
  festivalName: string;
  festivalDate: string;
  festivalEndDate: string | null;
  festivalImage: string | null;
  rating: number | null;
  publicComment: string | null;
  updatedAt: string;
  seenCount: number;
};

export type FollowFeedItem = {
  kind: "follow";
  userId: string;
  username: string;
  artistId: string;
  artistName: string;
  artistImage: string | null;
  updatedAt: string;
};

export type FeedItem = FestivalFeedItem | FollowFeedItem;

async function fetchFestivalActivity(friendIds: string[], before: Date | null): Promise<FestivalFeedItem[]> {
  const conditions = [inArray(userFestivals.userId, friendIds)];
  if (before) conditions.push(lt(userFestivals.updatedAt, before));

  const rows = await db
    .select({
      userId: userFestivals.userId,
      username: users.username,
      festivalId: userFestivals.festivalId,
      festivalName: festivals.name,
      festivalDate: festivals.date,
      festivalEndDate: festivals.endDate,
      festivalImage: festivals.imageUrl,
      rating: userFestivals.rating,
      publicComment: userFestivals.publicComment,
      updatedAt: userFestivals.updatedAt,
      // Covered by the user_festival_artist_ratings PK (userId, festivalId,
      // artistId) — no new index needed for this correlated count.
      seenCount: sql<number>`(
        SELECT count(*)::int FROM ${userFestivalArtistRatings}
        WHERE ${userFestivalArtistRatings.userId} = ${userFestivals.userId}
          AND ${userFestivalArtistRatings.festivalId} = ${userFestivals.festivalId}
      )`,
    })
    .from(userFestivals)
    .innerJoin(festivals, eq(userFestivals.festivalId, festivals.id))
    .innerJoin(users, eq(userFestivals.userId, users.id))
    .where(and(...conditions))
    // Secondary key is purely for determinism on any remaining exact
    // updated_at ties, not meaningful chronology on its own.
    .orderBy(desc(userFestivals.updatedAt), userFestivals.festivalId)
    .limit(FEED_PAGE_SIZE);

  return rows.map((r) => ({ kind: "festival" as const, ...r, updatedAt: r.updatedAt.toISOString() }));
}

async function fetchFollowActivity(friendIds: string[], before: Date | null): Promise<FollowFeedItem[]> {
  const conditions = [inArray(userArtistFollows.userId, friendIds)];
  if (before) conditions.push(lt(userArtistFollows.createdAt, before));

  const rows = await db
    .select({
      userId: userArtistFollows.userId,
      username: users.username,
      artistId: userArtistFollows.artistId,
      artistName: artists.name,
      artistImage: artists.imageUrl,
      createdAt: userArtistFollows.createdAt,
    })
    .from(userArtistFollows)
    .innerJoin(artists, eq(userArtistFollows.artistId, artists.id))
    .innerJoin(users, eq(userArtistFollows.userId, users.id))
    .where(and(...conditions))
    .orderBy(desc(userArtistFollows.createdAt), userArtistFollows.artistId)
    .limit(FEED_PAGE_SIZE);

  return rows.map(({ createdAt, ...r }) => ({ kind: "follow" as const, ...r, updatedAt: createdAt.toISOString() }));
}

/**
 * Friends' recent activity, newest first: festival attendance/ratings/public
 * comments, plus "started following <artist>". The two streams are paged
 * independently with the same timestamp cursor (the `updatedAt` of the last
 * item from a previous page — keyset pagination, not OFFSET) and merged. Any
 * item cut off by the page size is older than the new cursor, so the next
 * page picks it up.
 */
export async function getFriendsFeed(cursor?: string): Promise<{ items: FeedItem[]; nextCursor: string | null }> {
  const userId = await requireAuth();
  const friendIds = await fetchAcceptedFriendIds(userId);
  if (friendIds.length === 0) return { items: [], nextCursor: null };

  const before = cursor ? new Date(cursor) : null;
  const [festivalItems, followItems] = await Promise.all([
    fetchFestivalActivity(friendIds, before),
    fetchFollowActivity(friendIds, before),
  ]);

  const merged: FeedItem[] = [...festivalItems, ...followItems].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const items = merged.slice(0, FEED_PAGE_SIZE);
  const hasMore =
    merged.length > FEED_PAGE_SIZE ||
    festivalItems.length === FEED_PAGE_SIZE ||
    followItems.length === FEED_PAGE_SIZE;
  const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].updatedAt : null;
  return { items, nextCursor };
}
