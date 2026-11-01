import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireAuth, enforceRateLimit } from "./festival-helpers";
import { RATE_LIMIT_ACCOUNT_MAX, RATE_LIMIT_WINDOW_MS } from "@/lib/constants";

const WRONG_PASSWORD = "That password is not correct";

/**
 * Sensitive account actions (password, email, deletion) re-check the current password: a session alone (e.g. a
 * borrowed, unlocked phone) must not be enough to lock the owner out or erase
 * their account. Rate-limited per user so the check can't be brute-forced.
 */
export async function requireCurrentPassword(password: unknown): Promise<string> {
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
