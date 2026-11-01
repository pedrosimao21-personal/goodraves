"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireCurrentPassword } from "./account-core";
import { deleteStoredPhoto, getAvatarUrl } from "@/db/avatar-core";
import { getPasswordError, hashPassword } from "@/lib/password";

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const userId = await requireCurrentPassword(currentPassword);
  const passwordError = getPasswordError(newPassword);
  if (passwordError) throw new Error(passwordError);

  await db.update(users).set({ passwordHash: await hashPassword(newPassword) }).where(eq(users.id, userId));
}

/**
 * Permanently delete the signed-in user. Every per-user table (attendance,
 * ratings, notes, follows, friendships) cascades from users, so this one
 * delete erases all of their data. The caller signs the session out after.
 */
export async function deleteAccount(currentPassword: string): Promise<void> {
  const userId = await requireCurrentPassword(currentPassword);
  const avatarUrl = await getAvatarUrl(userId);
  await db.delete(users).where(eq(users.id, userId));
  await deleteStoredPhoto(avatarUrl); // the photo file is not in the database, so it is removed separately
}
