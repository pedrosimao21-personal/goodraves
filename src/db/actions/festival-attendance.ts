"use server";

import { db } from "@/db";
import { eq, and, sql } from "drizzle-orm";
import {
  userFestivals,
  userFestivalArtistRatings,
  userArtistGlobal,
} from "@/db/schema";
import { requireAuth, validateRating, MAX_NOTES_LENGTH } from "./festival-helpers";

// ── Add / remove attendance ────────────────────────────
export async function addAttendance(
  festivalId: string,
  status: "attended" | "upcoming" = "attended"
) {
  const userId = await requireAuth();
  await db
    .insert(userFestivals)
    .values({ userId, festivalId, status })
    .onConflictDoUpdate({
      target: [userFestivals.userId, userFestivals.festivalId],
      set: { status },
    });
}

export async function removeAttendance(festivalId: string) {
  const userId = await requireAuth();
  await db
    .delete(userFestivalArtistRatings)
    .where(
      and(
        eq(userFestivalArtistRatings.userId, userId),
        eq(userFestivalArtistRatings.festivalId, festivalId)
      )
    );
  await db
    .delete(userFestivals)
    .where(
      and(
        eq(userFestivals.userId, userId),
        eq(userFestivals.festivalId, festivalId)
      )
    );
}

// ── Set festival notes ─────────────────────────────────
export async function setFestivalNotes(
  festivalId: string,
  notes: string
) {
  const userId = await requireAuth();
  if (notes.length > MAX_NOTES_LENGTH) {
    throw new Error(`Notes must be under ${MAX_NOTES_LENGTH} characters`);
  }
  await db
    .insert(userFestivals)
    .values({ userId, festivalId, notes, status: "attended" })
    .onConflictDoUpdate({
      target: [userFestivals.userId, userFestivals.festivalId],
      set: { notes },
    });
}

// ── Rate a festival ────────────────────────────────────
export async function rateFestival(
  festivalId: string,
  rating: number
) {
  const userId = await requireAuth();
  const validRating = validateRating(rating);
  await db
    .insert(userFestivals)
    .values({ userId, festivalId, rating: validRating, status: "attended" })
    .onConflictDoUpdate({
      target: [userFestivals.userId, userFestivals.festivalId],
      set: { rating: validRating },
    });
}

// ── Toggle saw artist (mark/unmark as seen) ────────────
export async function toggleSawArtist(
  festivalId: string,
  artistId: string
) {
  const userId = await requireAuth();
  const [existing] = await db
    .select()
    .from(userFestivalArtistRatings)
    .where(
      and(
        eq(userFestivalArtistRatings.userId, userId),
        eq(userFestivalArtistRatings.festivalId, festivalId),
        eq(userFestivalArtistRatings.artistId, artistId)
      )
    )
    .limit(1);

  if (existing) {
    await db
      .delete(userFestivalArtistRatings)
      .where(
        and(
          eq(userFestivalArtistRatings.userId, userId),
          eq(userFestivalArtistRatings.festivalId, festivalId),
          eq(userFestivalArtistRatings.artistId, artistId)
        )
      );
    return false;
  }

  await db
    .insert(userFestivalArtistRatings)
    .values({ userId, festivalId, artistId });
  return true;
}

// ── Rate an artist at a festival ───────────────────────
export async function rateArtist(
  festivalId: string,
  artistId: string,
  rating: number
) {
  const userId = await requireAuth();

  if (rating === 0) {
    await db
      .delete(userFestivalArtistRatings)
      .where(
        and(
          eq(userFestivalArtistRatings.userId, userId),
          eq(userFestivalArtistRatings.festivalId, festivalId),
          eq(userFestivalArtistRatings.artistId, artistId)
        )
      );
    return;
  }

  const validRating = validateRating(rating);
  await db
    .insert(userFestivalArtistRatings)
    .values({ userId, festivalId, artistId, rating: validRating })
    .onConflictDoUpdate({
      target: [
        userFestivalArtistRatings.userId,
        userFestivalArtistRatings.festivalId,
        userFestivalArtistRatings.artistId,
      ],
      set: { rating: validRating },
    });
}

// ── Clear all user festivals by status ─────────────────
export async function clearUserFestivals(
  status: "attended" | "upcoming"
) {
  const userId = await requireAuth();
  const toDelete = await db
    .select({ festivalId: userFestivals.festivalId })
    .from(userFestivals)
    .where(
      and(eq(userFestivals.userId, userId), eq(userFestivals.status, status))
    );

  const ids = toDelete.map((r) => r.festivalId);
  if (ids.length > 0) {
    await db
      .delete(userFestivalArtistRatings)
      .where(
        and(
          eq(userFestivalArtistRatings.userId, userId),
          sql`${userFestivalArtistRatings.festivalId} IN ${ids}`
        )
      );
  }

  await db
    .delete(userFestivals)
    .where(
      and(eq(userFestivals.userId, userId), eq(userFestivals.status, status))
    );
}

// ── Global artist rating (not per-festival) ────────────
export async function setGlobalArtistRating(
  artistId: string,
  rating: number
) {
  const userId = await requireAuth();
  const validRating = validateRating(rating);
  await db
    .insert(userArtistGlobal)
    .values({ userId, artistId, rating: validRating })
    .onConflictDoUpdate({
      target: [userArtistGlobal.userId, userArtistGlobal.artistId],
      set: { rating: validRating },
    });
}

// ── Global artist notes ────────────────────────────────
export async function setGlobalArtistNotes(
  artistId: string,
  notes: string
) {
  const userId = await requireAuth();
  if (notes.length > MAX_NOTES_LENGTH) {
    throw new Error(`Notes must be under ${MAX_NOTES_LENGTH} characters`);
  }
  await db
    .insert(userArtistGlobal)
    .values({ userId, artistId, notes })
    .onConflictDoUpdate({
      target: [userArtistGlobal.userId, userArtistGlobal.artistId],
      set: { notes },
    });
}
