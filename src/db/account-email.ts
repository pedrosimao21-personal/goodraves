import { db } from "@/db";
import { and, isNull, isNotNull, ne, sql } from "drizzle-orm";
import { users } from "@/db/schema";
import { issueAuthToken, type AuthTokenKind } from "@/db/auth-tokens";
import { sendEmail } from "@/services/email/client";
import { buildResetEmail, buildVerifyEmail } from "@/services/email/templates";
import { getAppOrigin } from "@/lib/app-origin";
import { EMAIL_VERIFY_TOKEN_TTL_MS, PASSWORD_RESET_TOKEN_TTL_MS } from "@/lib/constants";

/**
 * Account email plumbing shared by the registration route, the password-reset
 * routes and the profile actions. Plain server module: not `"use server"`.
 * `email` is always already normalized (lib/email-address.ts).
 */

const lowerEmail = sql`lower(${users.email})`;

/** True when a different account has already verified this address. */
export async function isEmailVerifiedByOther(email: string, exceptUserId?: string): Promise<boolean> {
  const conditions = [sql`${lowerEmail} = ${email}`, isNotNull(users.emailVerifiedAt)];
  if (exceptUserId) conditions.push(ne(users.id, exceptUserId));
  const [row] = await db.select({ id: users.id }).from(users).where(and(...conditions)).limit(1);
  return Boolean(row);
}

/**
 * An address someone typed but never verified doesn't belong to them yet, so it
 * must not lock out the real owner: clear it from every unverified account.
 */
export async function releaseUnverifiedEmail(email: string): Promise<void> {
  await db
    .update(users)
    .set({ email: null })
    .where(and(sql`${lowerEmail} = ${email}`, isNull(users.emailVerifiedAt)));
}

async function mailLink(
  userId: string,
  email: string,
  kind: AuthTokenKind,
  ttlMs: number,
  path: string,
  build: (link: string) => { subject: string; text: string; html: string }
): Promise<void> {
  const token = await issueAuthToken(userId, kind, email, ttlMs);
  const link = `${await getAppOrigin()}${path}?token=${token}`;
  await sendEmail({ to: email, ...build(link) });
}

/** Emails the "confirm your address" link. Throws if the email provider fails. */
export function sendVerificationEmail(userId: string, email: string): Promise<void> {
  return mailLink(userId, email, "verify_email", EMAIL_VERIFY_TOKEN_TTL_MS, "/verify-email", buildVerifyEmail);
}

/**
 * Like sendVerificationEmail, for callers that must carry on when the provider
 * fails (the account or address is already saved): reports success as a boolean.
 */
export function trySendVerificationEmail(userId: string, email: string): Promise<boolean> {
  return sendVerificationEmail(userId, email).then(
    () => true,
    (err) => {
      console.error("[account-email] verification email failed:", err);
      return false;
    }
  );
}

/** Emails the "choose a new password" link. Throws if the email provider fails. */
export function sendPasswordResetEmail(userId: string, email: string): Promise<void> {
  return mailLink(userId, email, "reset_password", PASSWORD_RESET_TOKEN_TTL_MS, "/reset-password", buildResetEmail);
}
