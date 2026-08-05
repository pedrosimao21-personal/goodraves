"use server";

import { db } from "@/db";
import { eq, and, inArray } from "drizzle-orm";
import {
  festivalArtists,
  festivalTimetableSlots,
  festivalGenres,
  festivalB2bSets,
  festivalB2bSetMembers,
  userFestivals,
  userFestivalArtistRatings,
} from "@/db/schema";

/**
 * Additive per-table copy helpers for merging one festival's children onto
 * another. Every function here is safe to re-run (idempotent) — repeating a
 * merge after a partial failure just re-does the same additive work.
 */

export async function copyLineup(loserId: string, winnerId: string): Promise<number> {
  const rows = await db
    .select({ artistId: festivalArtists.artistId })
    .from(festivalArtists)
    .where(eq(festivalArtists.festivalId, loserId));
  if (rows.length === 0) return 0;

  await db
    .insert(festivalArtists)
    .values(rows.map((r) => ({ festivalId: winnerId, artistId: r.artistId })))
    .onConflictDoNothing();
  return rows.length;
}

export async function copyTimetableSlots(loserId: string, winnerId: string): Promise<number> {
  const rows = await db
    .select()
    .from(festivalTimetableSlots)
    .where(eq(festivalTimetableSlots.festivalId, loserId));
  if (rows.length === 0) return 0;

  await db
    .insert(festivalTimetableSlots)
    .values(
      rows.map((r) => ({
        festivalId: winnerId,
        artistId: r.artistId,
        stageName: r.stageName,
        startTime: r.startTime,
        endTime: r.endTime,
        stageOrder: r.stageOrder,
        slotOrder: r.slotOrder,
        slotDate: r.slotDate,
      }))
    )
    .onConflictDoNothing();
  return rows.length;
}

export async function copyGenres(loserId: string, winnerId: string): Promise<void> {
  const rows = await db
    .select({ genreId: festivalGenres.genreId })
    .from(festivalGenres)
    .where(eq(festivalGenres.festivalId, loserId));
  if (rows.length === 0) return;

  await db
    .insert(festivalGenres)
    .values(rows.map((r) => ({ festivalId: winnerId, genreId: r.genreId })))
    .onConflictDoNothing();
}

/**
 * Copy B2B sets (+ members), deduped on `originalArtistName` — the table has
 * no unique constraint, so a blind copy would duplicate any set that already
 * exists on the winner (e.g. both rows independently split the same B2B act).
 */
export async function copyB2bSets(loserId: string, winnerId: string): Promise<void> {
  const [loserSets, winnerSets] = await Promise.all([
    db.select().from(festivalB2bSets).where(eq(festivalB2bSets.festivalId, loserId)),
    db.select().from(festivalB2bSets).where(eq(festivalB2bSets.festivalId, winnerId)),
  ]);
  if (loserSets.length === 0) return;

  const winnerNames = new Set(winnerSets.map((s) => s.originalArtistName));
  const setsToCopy = loserSets.filter((s) => !winnerNames.has(s.originalArtistName));
  if (setsToCopy.length === 0) return;

  const loserSetIds = setsToCopy.map((s) => s.id);
  const memberRows = await db
    .select()
    .from(festivalB2bSetMembers)
    .where(inArray(festivalB2bSetMembers.b2bSetId, loserSetIds));
  const membersBySetId = new Map<string, { artistId: string; position: number }[]>();
  for (const m of memberRows) {
    const list = membersBySetId.get(m.b2bSetId) ?? [];
    list.push({ artistId: m.artistId, position: m.position });
    membersBySetId.set(m.b2bSetId, list);
  }

  // New rows get fresh UUIDs (defaultRandom), so a plain multi-row INSERT with
  // RETURNING preserves order for zipping ids back to their source set.
  const newSetRows = await db
    .insert(festivalB2bSets)
    .values(setsToCopy.map((s) => ({ festivalId: winnerId, originalArtistName: s.originalArtistName })))
    .returning({ id: festivalB2bSets.id });

  const memberInserts = setsToCopy.flatMap((s, i) =>
    (membersBySetId.get(s.id) ?? []).map((m) => ({
      b2bSetId: newSetRows[i].id,
      artistId: m.artistId,
      position: m.position,
    }))
  );
  if (memberInserts.length > 0) {
    await db.insert(festivalB2bSetMembers).values(memberInserts);
  }
}

/**
 * Upsert the loser's attendance rows onto the winner. On a collision (the
 * same user marked both the loser and winner as attended), keeps the higher
 * rating, concatenates non-empty notes, and keeps the earliest `createdAt`.
 */
export async function copyUserFestivals(loserId: string, winnerId: string): Promise<void> {
  const [loserRows, winnerRows] = await Promise.all([
    db.select().from(userFestivals).where(eq(userFestivals.festivalId, loserId)),
    db.select().from(userFestivals).where(eq(userFestivals.festivalId, winnerId)),
  ]);
  if (loserRows.length === 0) return;

  const winnerByUser = new Map(winnerRows.map((r) => [r.userId, r]));

  for (const loser of loserRows) {
    const existing = winnerByUser.get(loser.userId);
    if (!existing) {
      await db
        .insert(userFestivals)
        .values({ userId: loser.userId, festivalId: winnerId, rating: loser.rating, notes: loser.notes, createdAt: loser.createdAt })
        .onConflictDoNothing();
      continue;
    }

    const rating = maxOrEither(existing.rating, loser.rating);
    const notes = concatNotes(existing.notes, loser.notes);
    const createdAt = existing.createdAt < loser.createdAt ? existing.createdAt : loser.createdAt;
    await db
      .update(userFestivals)
      .set({ rating, notes, createdAt })
      .where(and(eq(userFestivals.userId, loser.userId), eq(userFestivals.festivalId, winnerId)));
  }
}

/**
 * Upsert the loser's per-artist ratings onto the winner. On a collision (the
 * user rated the same artist on both the loser and winner rows — the common
 * case for a merged multi-day festival), the winner's existing rating/notes
 * win when present; this table has no timestamp to break ties by recency.
 */
export async function copyUserFestivalArtistRatings(loserId: string, winnerId: string): Promise<void> {
  const [loserRows, winnerRows] = await Promise.all([
    db.select().from(userFestivalArtistRatings).where(eq(userFestivalArtistRatings.festivalId, loserId)),
    db.select().from(userFestivalArtistRatings).where(eq(userFestivalArtistRatings.festivalId, winnerId)),
  ]);
  if (loserRows.length === 0) return;

  const winnerByKey = new Map(winnerRows.map((r) => [`${r.userId}::${r.artistId}`, r]));

  for (const loser of loserRows) {
    const key = `${loser.userId}::${loser.artistId}`;
    const existing = winnerByKey.get(key);
    if (!existing) {
      await db
        .insert(userFestivalArtistRatings)
        .values({ userId: loser.userId, festivalId: winnerId, artistId: loser.artistId, rating: loser.rating, notes: loser.notes })
        .onConflictDoNothing();
      continue;
    }

    const rating = existing.rating ?? loser.rating;
    const notes = concatNotes(existing.notes, loser.notes);
    await db
      .update(userFestivalArtistRatings)
      .set({ rating, notes })
      .where(
        and(
          eq(userFestivalArtistRatings.userId, loser.userId),
          eq(userFestivalArtistRatings.festivalId, winnerId),
          eq(userFestivalArtistRatings.artistId, loser.artistId)
        )
      );
  }
}

function maxOrEither(a: number | null, b: number | null): number | null {
  if (a === null) return b;
  if (b === null) return a;
  return Math.max(a, b);
}

function concatNotes(a: string | null, b: string | null): string | null {
  const parts = [a, b].map((n) => n?.trim()).filter((n): n is string => !!n);
  if (parts.length === 0) return null;
  if (parts[0] === parts[1]) return parts[0];
  return parts.join("\n\n---\n\n");
}
