"use server";

import { db } from "@/db";
import { eq } from "drizzle-orm";
import { users } from "@/db/schema";
import { requireAuth } from "./festival-helpers";
import { MAX_CITY_LENGTH, MAX_GENRES_LENGTH } from "@/lib/constants";

export type UserProfile = {
  id: string;
  username: string;
  city: string | null;
  favoriteGenres: string | null;
};

/**
 * Fetch the current user's profile fields.
 * Returns null if the session is invalid.
 */
export async function getUserProfile(): Promise<UserProfile | null> {
  const userId = await requireAuth();

  const [row] = await db
    .select({
      id: users.id,
      username: users.username,
      city: users.city,
      favoriteGenres: users.favoriteGenres,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return row ?? null;
}

/**
 * Update city and/or favoriteGenres for the current user.
 * Only provided (non-undefined) fields are updated.
 */
export async function updateUserProfile(data: {
  city?: string;
  favoriteGenres?: string;
}): Promise<void> {
  const userId = await requireAuth();

  const updateFields: Partial<typeof users.$inferInsert> = {};

  if (data.city !== undefined) {
    const trimmed = data.city.trim() || null;
    if (trimmed && trimmed.length > MAX_CITY_LENGTH) {
      throw new Error(`City must be at most ${MAX_CITY_LENGTH} characters`);
    }
    updateFields.city = trimmed;
  }
  if (data.favoriteGenres !== undefined) {
    const trimmed = data.favoriteGenres.trim() || null;
    if (trimmed && trimmed.length > MAX_GENRES_LENGTH) {
      throw new Error(`Favorite genres must be at most ${MAX_GENRES_LENGTH} characters`);
    }
    updateFields.favoriteGenres = trimmed;
  }

  if (Object.keys(updateFields).length === 0) return;

  await db.update(users).set(updateFields).where(eq(users.id, userId));
}
