"use server";

/**
 * Which friends are going where, for Discover. Both actions derive the user
 * from the session and return nothing for a visitor who isn't logged in, so
 * Discover stays public.
 */

import { getOptionalUserId } from "./festival-helpers";
import { fetchAcceptedFriendIds } from "./friend-ids";
import { fetchFriendsGoingByFestival } from "./follow-friend-lookups";
import { fetchFriendsUpcomingFestivals, type FriendsFestival } from "./friends-going-core";

/** Upper bound on ids per call; a search page shows far fewer. */
const MAX_FESTIVAL_IDS = 200;
const FRIENDS_UPCOMING_LIMIT = 12;

/** festivalId -> usernames of the user's friends who added it. Only festivals with friends are listed. */
export async function getFriendsGoingForFestivals(festivalIds: string[]): Promise<Record<string, string[]>> {
  const userId = await getOptionalUserId();
  if (!userId || !Array.isArray(festivalIds)) return {};

  const ids = [...new Set(festivalIds.filter((id) => typeof id === "string"))].slice(0, MAX_FESTIVAL_IDS);
  const friendIds = await fetchAcceptedFriendIds(userId);
  const byFestival = await fetchFriendsGoingByFestival(friendIds, ids);
  return Object.fromEntries(byFestival);
}

/** Upcoming festivals the user's friends are going to, soonest first (see fetchFriendsUpcomingFestivals). */
export async function getFriendsUpcomingFestivals(): Promise<FriendsFestival[]> {
  const userId = await getOptionalUserId();
  if (!userId) return [];
  const friendIds = await fetchAcceptedFriendIds(userId);
  return fetchFriendsUpcomingFestivals(friendIds, FRIENDS_UPCOMING_LIMIT);
}
