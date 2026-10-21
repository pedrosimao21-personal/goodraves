/**
 * Friends' upcoming festivals for Discover's "Friends are going" row.
 *
 * Plain server-only module, deliberately NOT `"use server"`: it takes
 * arbitrary friend ids, so callers derive them from the session first
 * (getFriendsUpcomingFestivals in friends-going.ts).
 */

import { db } from "@/db";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { festivals, userFestivals, users } from "@/db/schema";
import { toIsoDate } from "@/lib/dates";

export type FriendsFestival = {
  festivalId: string;
  name: string;
  date: string;
  endDate: string | null;
  imageUrl: string | null;
  venue: string | null;
  location: string | null;
  friends: string[];
};

type FriendsFestivalRow = Omit<FriendsFestival, "friends"> & { username: string };

function groupByFestival(rows: FriendsFestivalRow[]): FriendsFestival[] {
  const byId = new Map<string, FriendsFestival>();
  for (const { username, ...festival } of rows) {
    const entry = byId.get(festival.festivalId) ?? { ...festival, friends: [] };
    entry.friends.push(username);
    byId.set(festival.festivalId, entry);
  }
  return [...byId.values()];
}

/**
 * Festivals the given friends are going to that haven't ended yet, soonest
 * first. Compares on end_date when set, so a running festival stays listed.
 */
export async function fetchFriendsUpcomingFestivals(friendIds: string[], limit: number): Promise<FriendsFestival[]> {
  if (friendIds.length === 0) return [];

  const today = toIsoDate(new Date());
  const rows = await db
    .select({
      festivalId: festivals.id,
      name: festivals.name,
      date: festivals.date,
      endDate: festivals.endDate,
      imageUrl: festivals.imageUrl,
      venue: festivals.venue,
      location: festivals.location,
      username: users.username,
    })
    .from(userFestivals)
    .innerJoin(festivals, eq(festivals.id, userFestivals.festivalId))
    .innerJoin(users, eq(users.id, userFestivals.userId))
    .where(
      and(
        inArray(userFestivals.userId, friendIds),
        sql`coalesce(${festivals.endDate}, ${festivals.date}) >= ${today}`
      )
    )
    .orderBy(asc(festivals.date), asc(users.username));

  return groupByFestival(rows as FriendsFestivalRow[]).slice(0, limit);
}
