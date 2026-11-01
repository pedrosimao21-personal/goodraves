"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireAuth, enforceRateLimit } from "./festival-helpers";
import { requireCurrentPassword } from "./account-core";
import { isEmailVerifiedByOther, releaseUnverifiedEmail, trySendVerificationEmail } from "@/db/account-email";
import { normalizeEmail } from "@/lib/email-address";
import { RATE_LIMIT_EMAIL_FLOW_MAX, RATE_LIMIT_EMAIL_FLOW_WINDOW_MS } from "@/lib/constants";

export type AccountEmail = { email: string | null; isVerified: boolean };
/** `isEmailSent` is false when the address was saved but the email provider failed: the user can resend. */
export type EmailChangeResult = { email: string | null; isVerified: boolean; isEmailSent: boolean };

const UNUSABLE_EMAIL = "That email address can't be used. Try another one.";

/** The signed-in user's email and whether it has been confirmed. */
export async function getAccountEmail(): Promise<AccountEmail> {
  const userId = await requireAuth();
  const [row] = await db.select({ email: users.email, verifiedAt: users.emailVerifiedAt }).from(users).where(eq(users.id, userId)).limit(1);
  return { email: row?.email ?? null, isVerified: Boolean(row?.verifiedAt) };
}

/**
 * Sets, changes or (with an empty string) removes the account's email. The new
 * address starts unconfirmed and gets a confirmation link; until it's confirmed
 * it can't be used to log in or reset a password. Needs the current password.
 */
export async function setAccountEmail(rawEmail: string, currentPassword: string): Promise<EmailChangeResult> {
  const userId = await requireCurrentPassword(currentPassword);

  if (rawEmail.trim() === "") {
    await db.update(users).set({ email: null, emailVerifiedAt: null }).where(eq(users.id, userId));
    return { email: null, isVerified: false, isEmailSent: true };
  }

  const email = normalizeEmail(rawEmail);
  if (!email) throw new Error("Enter a valid email address");
  if (await isEmailVerifiedByOther(email, userId)) throw new Error(UNUSABLE_EMAIL);

  const current = await getAccountEmail();
  if (current.email === email) return { email, isVerified: current.isVerified, isEmailSent: true };

  await releaseUnverifiedEmail(email);
  await db.update(users).set({ email, emailVerifiedAt: null }).where(eq(users.id, userId));
  return { email, isVerified: false, isEmailSent: await trySendVerificationEmail(userId, email) };
}

/** Sends the confirmation link again for an address that isn't confirmed yet. Returns false when the email provider failed. */
export async function resendVerificationEmail(): Promise<boolean> {
  const userId = await requireAuth();
  await enforceRateLimit("resend-verification", RATE_LIMIT_EMAIL_FLOW_MAX, RATE_LIMIT_EMAIL_FLOW_WINDOW_MS);

  const { email, isVerified } = await getAccountEmail();
  if (!email || isVerified) return true;
  return trySendVerificationEmail(userId, email);
}
