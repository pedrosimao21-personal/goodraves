import { createHmac, timingSafeEqual } from "node:crypto";
import { isNotificationKind, type NotificationKind } from "@/lib/notification-kinds";

/**
 * Unsubscribe links carry a signed token instead of a stored one: it has to keep
 * working for as long as the email sits in an inbox, and checking it needs no
 * database read. It only ever switches ONE notification of ONE user off.
 * Format: `<userId>.<kind>.<signature>`. Server-only (node:crypto).
 */

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PART_COUNT = 3;

function sign(userId: string, kind: NotificationKind): Buffer | null {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;
  return createHmac("sha256", secret).update(`unsubscribe:${userId}:${kind}`).digest();
}

export function createUnsubscribeToken(userId: string, kind: NotificationKind): string {
  const signature = sign(userId, kind);
  if (!signature) throw new Error("AUTH_SECRET is not configured");
  return `${userId}.${kind}.${signature.toString("base64url")}`;
}

/** The user and notification a token was made for, or null when it is malformed or was not signed by us. */
export function readUnsubscribeToken(token: string): { userId: string; kind: NotificationKind } | null {
  const parts = token.split(".");
  if (parts.length !== PART_COUNT) return null;
  const [userId, kind, signature] = parts;
  if (!UUID_PATTERN.test(userId) || !isNotificationKind(kind)) return null;

  const expected = sign(userId, kind);
  const given = Buffer.from(signature, "base64url");
  if (!expected || given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  return { userId, kind };
}
