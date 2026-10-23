"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireAuth, enforceRateLimit } from "./festival-helpers";
import { getPasswordError, hashPassword } from "@/lib/password";
import { RATE_LIMIT_ACCOUNT_MAX, RATE_LIMIT_WINDOW_MS } from "@/lib/constants";

const WRONG_PASSWORD = "That password is not correct";

/**
 * Both account actions re-check the current password: a session alone (e.g. a
 * borrowed, unlocked phone) must not be enough to lock the owner out or erase
 * their account. Rate-limited per user so the check can't be brute-forced.
 */
async function requireCurrentPassword(password: unknown): Promise<string> {
  const userId = await requireAuth();
  await enforceRateLimit("account", RATE_LIMIT_ACCOUNT_MAX, RATE_LIMIT_WINDOW_MS);

  const [user] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) throw new Error("Unauthorized");

  const isValid = typeof password === "string" && (await bcrypt.compare(password, user.passwordHash));
  if (!isValid) throw new Error(WRONG_PASSWORD);
  return userId;
}

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
  await db.delete(users).where(eq(users.id, userId));
}
