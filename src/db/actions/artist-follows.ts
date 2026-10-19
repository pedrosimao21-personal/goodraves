"use server";

import { db } from "@/db";
import { and, eq } from "drizzle-orm";
import { userArtistFollows } from "@/db/schema";
import { getOptionalUserId, requireAuth } from "./festival-helpers";
import { isUuid } from "@/lib/uuid";

// Caps the "Follow all" suggestions button; the suggestion list itself is
// smaller (FOLLOW_SUGGESTIONS_LIMIT), so this only stops a crafted call from
// inserting thousands of rows in one request.
const MAX_BULK_FOLLOW = 50;

function assertArtistIds(artistIds: string[]): void {
  if (artistIds.some((id) => !isUuid(id))) {
    throw new Error("Invalid artist id");
  }
}

/** Ids of every artist the current user follows (empty when logged out). */
export async function getFollowedArtistIds(): Promise<string[]> {
  const userId = await getOptionalUserId();
  if (!userId) return [];
  const rows = await db
    .select({ artistId: userArtistFollows.artistId })
    .from(userArtistFollows)
    .where(eq(userArtistFollows.userId, userId));
  return rows.map((r) => r.artistId);
}

export async function followArtist(artistId: string): Promise<void> {
  await followArtists([artistId]);
}

/** Follow several artists at once (the suggestions "Follow all" button). Idempotent. */
export async function followArtists(artistIds: string[]): Promise<void> {
  const userId = await requireAuth();
  const uniqueIds = [...new Set(artistIds)];
  if (uniqueIds.length === 0) return;
  if (uniqueIds.length > MAX_BULK_FOLLOW) {
    throw new Error(`You can follow at most ${MAX_BULK_FOLLOW} artists at once`);
  }
  assertArtistIds(uniqueIds);

  await db
    .insert(userArtistFollows)
    .values(uniqueIds.map((artistId) => ({ userId, artistId })))
    .onConflictDoNothing();
}

export async function unfollowArtist(artistId: string): Promise<void> {
  const userId = await requireAuth();
  assertArtistIds([artistId]);
  await db
    .delete(userArtistFollows)
    .where(and(eq(userArtistFollows.userId, userId), eq(userArtistFollows.artistId, artistId)));
}
