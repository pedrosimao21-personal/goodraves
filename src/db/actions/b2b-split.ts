"use server";

import { db } from "@/db";
import { eq, and, sql, inArray } from "drizzle-orm";
import {
  artists,
  festivalArtists,
  festivalB2bSets,
  festivalB2bSetMembers,
  userFestivalArtistRatings,
} from "@/db/schema";
import { requireAuth, requireAdmin, validateRating } from "./festival-helpers";
import { revalidatePath } from "next/cache";

const MIN_MEMBER_COUNT = 2;
const MAX_MEMBER_COUNT = 10;

// ── Types ─────────────────────────────────────────────────

export type B2bSetWithMembers = {
  id: string;
  festivalId: string;
  originalArtistName: string;
  members: { artistId: string; artistName: string; position: number }[];
};

// ── Split a B2B artist into individual members ────────────

export async function splitB2bArtist(
  festivalId: string,
  originalArtistId: string,
  memberNames: string[]
): Promise<B2bSetWithMembers> {
  await requireAdmin();
  const trimmedNames = memberNames.map((n) => n.trim()).filter(Boolean);
  if (trimmedNames.length < MIN_MEMBER_COUNT) {
    throw new Error(`At least ${MIN_MEMBER_COUNT} artist names are required`);
  }
  if (trimmedNames.length > MAX_MEMBER_COUNT) {
    throw new Error(`At most ${MAX_MEMBER_COUNT} artist names are allowed`);
  }

  const uniqueNames = [...new Set(trimmedNames.map((n) => n.toLowerCase()))];
  if (uniqueNames.length !== trimmedNames.length) {
    throw new Error("Duplicate artist names are not allowed");
  }

  // Look up the original compound artist
  const [originalArtist] = await db
    .select({ id: artists.id, name: artists.name })
    .from(artists)
    .where(eq(artists.id, originalArtistId))
    .limit(1);

  if (!originalArtist) {
    throw new Error("Original artist not found");
  }

  // Ensure all member artists exist (case-insensitive), create if missing
  const memberArtists = await ensureMemberArtists(trimmedNames);

  // Create the B2B set
  const [b2bSet] = await db
    .insert(festivalB2bSets)
    .values({
      festivalId,
      originalArtistName: originalArtist.name,
    })
    .returning({ id: festivalB2bSets.id });

  // Insert member rows with position ordering
  const memberInserts = memberArtists.map((member, idx) => ({
    b2bSetId: b2bSet.id,
    artistId: member.id,
    position: idx,
  }));
  await db.insert(festivalB2bSetMembers).values(memberInserts);

  // Add individual artists to the festival lineup (skip if already present)
  const lineupInserts = memberArtists.map((member) => ({
    festivalId,
    artistId: member.id,
  }));
  await db
    .insert(festivalArtists)
    .values(lineupInserts)
    .onConflictDoNothing();

  // Migrate existing performance ratings from the compound artist to each member
  await migrateRatingsToMembers(festivalId, originalArtistId, memberArtists);

  // Remove the compound artist from the festival lineup
  await db
    .delete(festivalArtists)
    .where(
      and(
        eq(festivalArtists.festivalId, festivalId),
        eq(festivalArtists.artistId, originalArtistId)
      )
    );

  // Delete the compound artist if no other festivals reference it
  await deleteOrphanedArtist(originalArtistId);

  revalidatePath(`/festival/${festivalId}`);

  return {
    id: b2bSet.id,
    festivalId,
    originalArtistName: originalArtist.name,
    members: memberArtists.map((m, idx) => ({
      artistId: m.id,
      artistName: m.name,
      position: idx,
    })),
  };
}

// ── Create a B2B set from existing festival artists ───────

export async function createB2bSet(
  festivalId: string,
  memberArtistIds: string[]
): Promise<B2bSetWithMembers> {
  await requireAdmin();

  if (memberArtistIds.length < MIN_MEMBER_COUNT) {
    throw new Error(`At least ${MIN_MEMBER_COUNT} artists are required`);
  }
  if (memberArtistIds.length > MAX_MEMBER_COUNT) {
    throw new Error(`At most ${MAX_MEMBER_COUNT} artists are allowed`);
  }

  const uniqueIds = new Set(memberArtistIds);
  if (uniqueIds.size !== memberArtistIds.length) {
    throw new Error("Duplicate artists are not allowed");
  }

  // Fetch the artist names in the given order
  const memberRows = await db
    .select({ id: artists.id, name: artists.name })
    .from(artists)
    .where(inArray(artists.id, memberArtistIds));

  if (memberRows.length !== memberArtistIds.length) {
    throw new Error("One or more artists were not found");
  }

  // Preserve insertion order
  const orderedMembers = memberArtistIds.map((id) => {
    const found = memberRows.find((r) => r.id === id);
    if (!found) throw new Error(`Artist ${id} not found`);
    return found;
  });

  const generatedName = orderedMembers.map((m) => m.name).join(" b2b ");

  const [b2bSet] = await db
    .insert(festivalB2bSets)
    .values({ festivalId, originalArtistName: generatedName })
    .returning({ id: festivalB2bSets.id });

  const memberInserts = orderedMembers.map((member, idx) => ({
    b2bSetId: b2bSet.id,
    artistId: member.id,
    position: idx,
  }));
  await db.insert(festivalB2bSetMembers).values(memberInserts);

  revalidatePath(`/festival/${festivalId}`);

  return {
    id: b2bSet.id,
    festivalId,
    originalArtistName: generatedName,
    members: orderedMembers.map((m, idx) => ({
      artistId: m.id,
      artistName: m.name,
      position: idx,
    })),
  };
}

// ── Unsplit (delete) a B2B set, restoring solo artists ────

export async function unsplitB2bSet(b2bSetId: string): Promise<void> {
  await requireAdmin();

  const [b2bSet] = await db
    .select({ id: festivalB2bSets.id, festivalId: festivalB2bSets.festivalId })
    .from(festivalB2bSets)
    .where(eq(festivalB2bSets.id, b2bSetId))
    .limit(1);

  if (!b2bSet) {
    throw new Error("B2B set not found");
  }

  // Deleting the set cascades to festivalB2bSetMembers — artists remain in
  // festival_artists and will reappear as solo artists automatically.
  await db.delete(festivalB2bSets).where(eq(festivalB2bSets.id, b2bSetId));

  revalidatePath(`/festival/${b2bSet.festivalId}`);
}

// ── Rate a B2B set (propagates to all members) ───────────

export async function rateB2bSet(b2bSetId: string, rating: number) {
  const userId = await requireAuth();

  // Look up the B2B set's festival and member artist IDs
  const [b2bSet] = await db
    .select({ festivalId: festivalB2bSets.festivalId })
    .from(festivalB2bSets)
    .where(eq(festivalB2bSets.id, b2bSetId))
    .limit(1);

  if (!b2bSet) {
    throw new Error("B2B set not found");
  }

  const members = await db
    .select({ artistId: festivalB2bSetMembers.artistId })
    .from(festivalB2bSetMembers)
    .where(eq(festivalB2bSetMembers.b2bSetId, b2bSetId));

  const memberArtistIds = members.map((m) => m.artistId);

  if (rating === 0) {
    await db
      .delete(userFestivalArtistRatings)
      .where(
        and(
          eq(userFestivalArtistRatings.userId, userId),
          eq(userFestivalArtistRatings.festivalId, b2bSet.festivalId),
          inArray(userFestivalArtistRatings.artistId, memberArtistIds)
        )
      );
    return;
  }

  const validRating = validateRating(rating);
  const ratingInserts = memberArtistIds.map((artistId) => ({
    userId,
    festivalId: b2bSet.festivalId,
    artistId,
    rating: validRating,
  }));

  for (const insert of ratingInserts) {
    await db
      .insert(userFestivalArtistRatings)
      .values(insert)
      .onConflictDoUpdate({
        target: [
          userFestivalArtistRatings.userId,
          userFestivalArtistRatings.festivalId,
          userFestivalArtistRatings.artistId,
        ],
        set: { rating: validRating },
      });
  }
}

// ── Get B2B sets for a festival ───────────────────────────

export async function getB2bSetsForFestival(
  festivalId: string
): Promise<B2bSetWithMembers[]> {
  const sets = await db
    .select()
    .from(festivalB2bSets)
    .where(eq(festivalB2bSets.festivalId, festivalId));

  if (sets.length === 0) return [];

  const setIds = sets.map((s) => s.id);
  const members = await db
    .select({
      b2bSetId: festivalB2bSetMembers.b2bSetId,
      artistId: festivalB2bSetMembers.artistId,
      artistName: artists.name,
      position: festivalB2bSetMembers.position,
    })
    .from(festivalB2bSetMembers)
    .innerJoin(artists, eq(festivalB2bSetMembers.artistId, artists.id))
    .where(inArray(festivalB2bSetMembers.b2bSetId, setIds));

  const membersBySet = new Map<string, B2bSetWithMembers["members"]>();
  for (const m of members) {
    const list = membersBySet.get(m.b2bSetId) ?? [];
    list.push({ artistId: m.artistId, artistName: m.artistName, position: m.position });
    membersBySet.set(m.b2bSetId, list);
  }

  return sets.map((s) => ({
    id: s.id,
    festivalId: s.festivalId,
    originalArtistName: s.originalArtistName,
    members: (membersBySet.get(s.id) ?? []).sort((a, b) => a.position - b.position),
  }));
}

// ── Helpers ───────────────────────────────────────────────

/**
 * Look up or create artists by name (case-insensitive).
 * Returns { id, name } for each, preserving input order.
 */
async function ensureMemberArtists(
  names: string[]
): Promise<{ id: string; name: string }[]> {
  const results: { id: string; name: string }[] = [];

  for (const name of names) {
    // Case-insensitive lookup
    const [existing] = await db
      .select({ id: artists.id, name: artists.name })
      .from(artists)
      .where(sql`lower(${artists.name}) = lower(${name})`)
      .limit(1);

    if (existing) {
      results.push(existing);
      continue;
    }

    // Create the artist
    const [created] = await db
      .insert(artists)
      .values({ name })
      .onConflictDoNothing()
      .returning({ id: artists.id, name: artists.name });

    if (created) {
      results.push(created);
      continue;
    }

    // Race condition fallback
    const [raced] = await db
      .select({ id: artists.id, name: artists.name })
      .from(artists)
      .where(sql`lower(${artists.name}) = lower(${name})`)
      .limit(1);

    results.push(raced);
  }

  return results;
}

/**
 * Move performance ratings from the compound artist to each B2B member.
 * Each user who rated the compound artist gets that rating on every member.
 */
async function migrateRatingsToMembers(
  festivalId: string,
  originalArtistId: string,
  memberArtists: { id: string; name: string }[]
) {
  const existingRatings = await db
    .select({
      userId: userFestivalArtistRatings.userId,
      rating: userFestivalArtistRatings.rating,
    })
    .from(userFestivalArtistRatings)
    .where(
      and(
        eq(userFestivalArtistRatings.festivalId, festivalId),
        eq(userFestivalArtistRatings.artistId, originalArtistId)
      )
    );

  if (existingRatings.length === 0) return;

  const ratingInserts = existingRatings
    .filter((r) => r.rating !== null)
    .flatMap((r) =>
      memberArtists.map((member) => ({
        userId: r.userId,
        festivalId,
        artistId: member.id,
        rating: r.rating,
      }))
    );

  if (ratingInserts.length > 0) {
    await db
      .insert(userFestivalArtistRatings)
      .values(ratingInserts)
      .onConflictDoNothing();
  }

  // Remove the old compound artist ratings for this festival
  await db
    .delete(userFestivalArtistRatings)
    .where(
      and(
        eq(userFestivalArtistRatings.festivalId, festivalId),
        eq(userFestivalArtistRatings.artistId, originalArtistId)
      )
    );
}

/**
 * Delete an artist from the artists table if no festival_artists rows reference it.
 */
async function deleteOrphanedArtist(artistId: string) {
  const [stillReferenced] = await db
    .select({ artistId: festivalArtists.artistId })
    .from(festivalArtists)
    .where(eq(festivalArtists.artistId, artistId))
    .limit(1);

  if (stillReferenced) return;

  // Also check if the artist is a member of any B2B set
  const [inB2bSet] = await db
    .select({ artistId: festivalB2bSetMembers.artistId })
    .from(festivalB2bSetMembers)
    .where(eq(festivalB2bSetMembers.artistId, artistId))
    .limit(1);

  if (inB2bSet) return;

  await db.delete(artists).where(eq(artists.id, artistId));
}
