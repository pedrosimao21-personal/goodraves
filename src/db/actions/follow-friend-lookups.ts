/**
 * Friend overlays for the follow features: which friends follow an artist,
 * which friends are going to a festival.
 *
 * Plain server-only module, deliberately NOT `"use server"`: these take
 * arbitrary friend ids, so callers must derive them server-side from the
 * session (fetchAcceptedFriendIds on the requireAuth'd userId), never from
 * client input.
 */

import { db } from "@/db";
import { and, asc, eq, inArray } from "drizzle-orm";
import { userArtistFollows, userFestivals, users } from "@/db/schema";

type UsernamesByKey = Map<string, string[]>;

function groupUsernames(rows: { key: string; username: string }[]): UsernamesByKey {
  const grouped: UsernamesByKey = new Map();
  for (const row of rows) {
    const list = grouped.get(row.key) ?? [];
    list.push(row.username);
    grouped.set(row.key, list);
  }
  return grouped;
}

/** artistId -> usernames of the given friends who follow that artist. */
export async function fetchFriendsFollowingByArtist(
  friendIds: string[],
  artistIds: string[]
): Promise<UsernamesByKey> {
  if (friendIds.length === 0 || artistIds.length === 0) return new Map();

  const rows = await db
    .select({ key: userArtistFollows.artistId, username: users.username })
    .from(userArtistFollows)
    .innerJoin(users, eq(userArtistFollows.userId, users.id))
    .where(and(inArray(userArtistFollows.userId, friendIds), inArray(userArtistFollows.artistId, artistIds)))
    .orderBy(asc(users.username));
  return groupUsernames(rows);
}

/** festivalId -> usernames of the given friends who added that festival. */
export async function fetchFriendsGoingByFestival(
  friendIds: string[],
  festivalIds: string[]
): Promise<UsernamesByKey> {
  if (friendIds.length === 0 || festivalIds.length === 0) return new Map();

  const rows = await db
    .select({ key: userFestivals.festivalId, username: users.username })
    .from(userFestivals)
    .innerJoin(users, eq(userFestivals.userId, users.id))
    .where(and(inArray(userFestivals.userId, friendIds), inArray(userFestivals.festivalId, festivalIds)))
    .orderBy(asc(users.username));
  return groupUsernames(rows);
}
