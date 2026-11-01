"use server";

import { db } from "@/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  festivalB2bSetMembers,
  festivalB2bSets,
  userB2bSetRatings,
  userFestivalArtistRatings,
} from "@/db/schema";
import { requireAuth } from "./festival-helpers";
import { validateArtistRating } from "@/lib/rating";
import { memberRatingFromSets } from "@/lib/b2b-rating";

/**
 * Rates one B2B set (0 clears it). The rating belongs to the set alone, so another set that shares
 * a member (Armin b2b Deep Dish and Armin b2b Funk Tribu) keeps its own. Each member's rating for
 * the festival, which artist stats and "seen" read, is then worked out from the sets they are in.
 */
export async function rateB2bSet(b2bSetId: string, rating: number): Promise<void> {
  const userId = await requireAuth();

  const [b2bSet] = await db
    .select({ festivalId: festivalB2bSets.festivalId })
    .from(festivalB2bSets)
    .where(eq(festivalB2bSets.id, b2bSetId))
    .limit(1);
  if (!b2bSet) throw new Error("B2B set not found");

  if (rating === 0) {
    await db.delete(userB2bSetRatings).where(and(eq(userB2bSetRatings.userId, userId), eq(userB2bSetRatings.b2bSetId, b2bSetId)));
  } else {
    const validRating = validateArtistRating(rating);
    await db
      .insert(userB2bSetRatings)
      .values({ userId, b2bSetId, rating: validRating })
      .onConflictDoUpdate({ target: [userB2bSetRatings.userId, userB2bSetRatings.b2bSetId], set: { rating: validRating } });
  }

  const members = await db
    .select({ artistId: festivalB2bSetMembers.artistId })
    .from(festivalB2bSetMembers)
    .where(eq(festivalB2bSetMembers.b2bSetId, b2bSetId));
  await syncMemberRatings(userId, b2bSet.festivalId, members.map((m) => m.artistId));
}

/** Sets each member's festival rating from the rated sets they are in; a member left with none is cleared. */
async function syncMemberRatings(userId: string, festivalId: string, memberIds: string[]): Promise<void> {
  const rows = await db
    .select({ artistId: festivalB2bSetMembers.artistId, rating: userB2bSetRatings.rating })
    .from(userB2bSetRatings)
    .innerJoin(festivalB2bSets, eq(festivalB2bSets.id, userB2bSetRatings.b2bSetId))
    .innerJoin(festivalB2bSetMembers, eq(festivalB2bSetMembers.b2bSetId, festivalB2bSets.id))
    .where(
      and(
        eq(userB2bSetRatings.userId, userId),
        eq(festivalB2bSets.festivalId, festivalId),
        inArray(festivalB2bSetMembers.artistId, memberIds)
      )
    );

  const ratingsByArtist = new Map<string, number[]>();
  for (const row of rows) ratingsByArtist.set(row.artistId, [...(ratingsByArtist.get(row.artistId) ?? []), row.rating]);

  const toRate: { userId: string; festivalId: string; artistId: string; rating: number }[] = [];
  const toClear: string[] = [];
  for (const artistId of memberIds) {
    const memberRating = memberRatingFromSets(ratingsByArtist.get(artistId) ?? []);
    if (memberRating === null) toClear.push(artistId);
    else toRate.push({ userId, festivalId, artistId, rating: memberRating });
  }

  if (toRate.length > 0) {
    await db
      .insert(userFestivalArtistRatings)
      .values(toRate)
      .onConflictDoUpdate({
        target: [userFestivalArtistRatings.userId, userFestivalArtistRatings.festivalId, userFestivalArtistRatings.artistId],
        set: { rating: sql`excluded.rating` },
      });
  }
  if (toClear.length > 0) {
    await db
      .delete(userFestivalArtistRatings)
      .where(
        and(
          eq(userFestivalArtistRatings.userId, userId),
          eq(userFestivalArtistRatings.festivalId, festivalId),
          inArray(userFestivalArtistRatings.artistId, toClear)
        )
      );
  }
}
