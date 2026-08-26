"use server";

import { db } from "@/db";
import { eq, and, or, inArray, lt, desc, sql } from "drizzle-orm";
import { friendships, users, userFestivals, festivals, userFestivalArtistRatings, artists } from "@/db/schema";
import { requireAuth, enforceRateLimit } from "./festival-helpers";
import { RATE_LIMIT_SEARCH_MAX, RATE_LIMIT_WINDOW_MS } from "@/lib/constants";

const MAX_USERNAME_LENGTH = 30;
const FEED_PAGE_SIZE = 20;
const MIN_USER_SEARCH_LENGTH = 2;
const MAX_USER_SEARCH_RESULTS = 8;

/** True if the two users are accepted friends (either direction). */
async function areFriends(userA: string, userB: string): Promise<boolean> {
  const [row] = await db
    .select({ status: friendships.status })
    .from(friendships)
    .where(
      and(
        eq(friendships.status, "accepted"),
        or(
          and(eq(friendships.requesterId, userA), eq(friendships.addresseeId, userB)),
          and(eq(friendships.requesterId, userB), eq(friendships.addresseeId, userA))
        )
      )
    )
    .limit(1);
  return !!row;
}

async function findUserByUsername(username: string) {
  const [row] = await db
    .select({ id: users.id, username: users.username })
    .from(users)
    .where(sql`lower(${users.username}) = lower(${username})`)
    .limit(1);
  return row ?? null;
}

async function fetchUsernamesByIds(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const rows = await db
    .select({ id: users.id, username: users.username })
    .from(users)
    .where(inArray(users.id, ids));
  return new Map(rows.map((r) => [r.id, r.username]));
}

// ── Send / respond / remove ─────────────────────────────
export async function sendFriendRequest(username: string) {
  const userId = await requireAuth();
  const trimmed = username.trim().slice(0, MAX_USERNAME_LENGTH);
  const target = await findUserByUsername(trimmed);
  if (!target) throw new Error("No user found with that username");
  if (target.id === userId) throw new Error("You can't add yourself as a friend");

  const [reverse] = await db
    .select({ status: friendships.status })
    .from(friendships)
    .where(and(eq(friendships.requesterId, target.id), eq(friendships.addresseeId, userId)))
    .limit(1);

  // They already sent us a request — accept it instead of creating a
  // second, opposite-direction row for the same pair.
  if (reverse) {
    if (reverse.status === "pending") {
      await db
        .update(friendships)
        .set({ status: "accepted" })
        .where(and(eq(friendships.requesterId, target.id), eq(friendships.addresseeId, userId)));
    }
    return;
  }

  await db
    .insert(friendships)
    .values({ requesterId: userId, addresseeId: target.id })
    .onConflictDoNothing();
}

export async function respondToFriendRequest(requesterId: string, accept: boolean) {
  const userId = await requireAuth();
  if (accept) {
    await db
      .update(friendships)
      .set({ status: "accepted" })
      .where(and(eq(friendships.requesterId, requesterId), eq(friendships.addresseeId, userId)));
  } else {
    await db
      .delete(friendships)
      .where(and(eq(friendships.requesterId, requesterId), eq(friendships.addresseeId, userId)));
  }
}

export async function removeFriend(otherUserId: string) {
  const userId = await requireAuth();
  await db
    .delete(friendships)
    .where(
      or(
        and(eq(friendships.requesterId, userId), eq(friendships.addresseeId, otherUserId)),
        and(eq(friendships.requesterId, otherUserId), eq(friendships.addresseeId, userId))
      )
    );
}

// ── Search ───────────────────────────────────────────────
export type UserSearchResult = {
  id: string;
  username: string;
  friendStatus: "none" | "friends" | "outgoing" | "incoming";
};

/**
 * Username type-ahead for the "add friend" box. Rate-limited since it's a
 * free-text search over every account's username — without a cap this is an
 * enumeration vector, even though usernames aren't sensitive on their own.
 */
export async function searchUsers(query: string): Promise<UserSearchResult[]> {
  const userId = await requireAuth();
  await enforceRateLimit("search-users", RATE_LIMIT_SEARCH_MAX, RATE_LIMIT_WINDOW_MS);

  const trimmed = query.trim().slice(0, MAX_USERNAME_LENGTH);
  if (trimmed.length < MIN_USER_SEARCH_LENGTH) return [];

  // Escape ILIKE wildcards in the caller's input — unescaped, a bare "%"
  // matches every username, turning the 8-row cap into a pageable full
  // enumeration of every account (as festival-search.ts and nearby-shows.ts
  // already do for the same reason).
  const escaped = trimmed.replace(/[%_\\]/g, "\\$&");
  const pattern = `%${escaped}%`;
  const rows = await db
    .select({ id: users.id, username: users.username })
    .from(users)
    .where(and(sql`${users.username} ILIKE ${pattern}`, sql`${users.id} != ${userId}`))
    .limit(MAX_USER_SEARCH_RESULTS);

  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const friendshipRows = await db
    .select({ requesterId: friendships.requesterId, addresseeId: friendships.addresseeId, status: friendships.status })
    .from(friendships)
    .where(
      or(
        and(eq(friendships.requesterId, userId), inArray(friendships.addresseeId, ids)),
        and(eq(friendships.addresseeId, userId), inArray(friendships.requesterId, ids))
      )
    );

  const statusByOtherId = new Map<string, UserSearchResult["friendStatus"]>();
  for (const f of friendshipRows) {
    const otherId = f.requesterId === userId ? f.addresseeId : f.requesterId;
    if (f.status === "accepted") statusByOtherId.set(otherId, "friends");
    else statusByOtherId.set(otherId, f.requesterId === userId ? "outgoing" : "incoming");
  }

  return rows.map((r) => ({ ...r, friendStatus: statusByOtherId.get(r.id) ?? "none" }));
}

// ── Reads ────────────────────────────────────────────────
export type FriendEntry = { id: string; username: string };

export async function getFriendsData(): Promise<{
  friends: FriendEntry[];
  incoming: FriendEntry[];
  outgoing: FriendEntry[];
}> {
  const userId = await requireAuth();
  const rows = await db
    .select({
      requesterId: friendships.requesterId,
      addresseeId: friendships.addresseeId,
      status: friendships.status,
    })
    .from(friendships)
    .where(or(eq(friendships.requesterId, userId), eq(friendships.addresseeId, userId)));

  const otherIds = rows.map((r) => (r.requesterId === userId ? r.addresseeId : r.requesterId));
  const usernames = await fetchUsernamesByIds(otherIds);

  const friends: FriendEntry[] = [];
  const incoming: FriendEntry[] = [];
  const outgoing: FriendEntry[] = [];

  for (const r of rows) {
    const isMeRequester = r.requesterId === userId;
    const otherId = isMeRequester ? r.addresseeId : r.requesterId;
    const entry = { id: otherId, username: usernames.get(otherId) ?? "Unknown" };
    if (r.status === "accepted") friends.push(entry);
    else if (isMeRequester) outgoing.push(entry);
    else incoming.push(entry);
  }

  return { friends, incoming, outgoing };
}

export type FeedItem = {
  userId: string;
  username: string;
  festivalId: string;
  festivalName: string;
  festivalDate: string;
  festivalImage: string | null;
  rating: number | null;
  publicComment: string | null;
  updatedAt: string;
  seenCount: number;
};

/**
 * Friends' recent festival activity (attended/upcoming, ratings, public
 * comments), newest first. `cursor` is the `updatedAt` of the last item from
 * a previous page — keyset pagination, not OFFSET, so paging stays cheap as
 * a user's (or their friends') history grows.
 */
export async function getFriendsFeed(cursor?: string): Promise<{ items: FeedItem[]; nextCursor: string | null }> {
  const userId = await requireAuth();

  const friendRows = await db
    .select({ requesterId: friendships.requesterId, addresseeId: friendships.addresseeId })
    .from(friendships)
    .where(and(eq(friendships.status, "accepted"), or(eq(friendships.requesterId, userId), eq(friendships.addresseeId, userId))));

  const friendIds = friendRows.map((r) => (r.requesterId === userId ? r.addresseeId : r.requesterId));
  if (friendIds.length === 0) return { items: [], nextCursor: null };

  const conditions = [inArray(userFestivals.userId, friendIds)];
  if (cursor) conditions.push(lt(userFestivals.updatedAt, new Date(cursor)));

  const rows = await db
    .select({
      userId: userFestivals.userId,
      username: users.username,
      festivalId: userFestivals.festivalId,
      festivalName: festivals.name,
      festivalDate: festivals.date,
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

  const items = rows.map((r) => ({ ...r, updatedAt: r.updatedAt.toISOString() }));
  const nextCursor = items.length === FEED_PAGE_SIZE ? items[items.length - 1].updatedAt : null;
  return { items, nextCursor };
}

export type FriendArtistRating = { artistName: string; rating: number | null };

/**
 * The artists a friend saw at a specific festival, fetched on demand from
 * the feed's "N DJs seen" pill rather than embedded in every feed row.
 * `friendUserId`/`festivalId` come from the client, so — unlike the ids
 * used inside getFriendsFeed, which are derived server-side from the
 * caller's own friendships — this re-verifies the friendship itself before
 * returning anything: without that check, anyone could read anyone else's
 * seen-artist history by guessing a userId/festivalId pair.
 */
export async function getFriendArtistRatingsForFestival(
  friendUserId: string,
  festivalId: string
): Promise<FriendArtistRating[]> {
  const userId = await requireAuth();
  if (!(await areFriends(userId, friendUserId))) {
    throw new Error("You can only view a friend's activity");
  }

  return db
    .select({ artistName: artists.name, rating: userFestivalArtistRatings.rating })
    .from(userFestivalArtistRatings)
    .innerJoin(artists, eq(userFestivalArtistRatings.artistId, artists.id))
    .where(and(eq(userFestivalArtistRatings.userId, friendUserId), eq(userFestivalArtistRatings.festivalId, festivalId)))
    .orderBy(desc(userFestivalArtistRatings.rating));
}
