/**
 * Accepted-friend lookups shared by the friends feed and the follow features.
 *
 * Plain server-only module, deliberately NOT `"use server"`: these take an
 * arbitrary userId, so exposing them as Server Actions would let anyone list
 * anyone's friends by guessing a UUID. Callers derive the userId from the
 * session via requireAuth / getOptionalUserId first.
 */

import { db } from "@/db";
import { and, eq, inArray, or } from "drizzle-orm";
import { friendships, users } from "@/db/schema";

/** Ids of everyone with an accepted friendship with `userId`, either direction. */
export async function fetchAcceptedFriendIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({ requesterId: friendships.requesterId, addresseeId: friendships.addresseeId })
    .from(friendships)
    .where(
      and(
        eq(friendships.status, "accepted"),
        or(eq(friendships.requesterId, userId), eq(friendships.addresseeId, userId))
      )
    );
  return rows.map((r) => (r.requesterId === userId ? r.addresseeId : r.requesterId));
}

/** userId -> profile photo URL (null when they have none) for the given ids. */
export async function fetchAvatarUrlsByIds(ids: string[]): Promise<Map<string, string | null>> {
  if (ids.length === 0) return new Map();
  const rows = await db
    .select({ id: users.id, avatarUrl: users.avatarUrl })
    .from(users)
    .where(inArray(users.id, ids));
  return new Map(rows.map((r) => [r.id, r.avatarUrl]));
}

/** userId -> username for the given ids. */
export async function fetchUsernamesByIds(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const rows = await db
    .select({ id: users.id, username: users.username })
    .from(users)
    .where(inArray(users.id, ids));
  return new Map(rows.map((r) => [r.id, r.username]));
}
