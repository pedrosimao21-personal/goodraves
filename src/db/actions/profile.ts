"use server";

import { db } from "@/db";
import { eq } from "drizzle-orm";
import { users } from "@/db/schema";
import { requireAuth } from "./festival-helpers";

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
    updateFields.city = data.city.trim() || null;
  }
  if (data.favoriteGenres !== undefined) {
    updateFields.favoriteGenres = data.favoriteGenres.trim() || null;
  }

  if (Object.keys(updateFields).length === 0) return;

  await db.update(users).set(updateFields).where(eq(users.id, userId));
}
