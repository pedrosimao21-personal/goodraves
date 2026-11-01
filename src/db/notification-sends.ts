import { db } from "@/db";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { notificationSends } from "@/db/schema";
import { NOTIFICATION_SENDS_RETENTION_DAYS } from "@/lib/constants";
import type { NotificationKind } from "@/lib/notification-kinds";

/**
 * The ledger of notification emails. A message is claimed before it is sent: the
 * primary key makes the claim succeed once, so a repeated or overlapping cron run
 * cannot send the same thing twice. Plain server module (not `"use server"`).
 */

/** True when the caller now owns this message; false when it was already claimed. */
export async function claimNotificationSend(userId: string, kind: NotificationKind, ref: string): Promise<boolean> {
  const claimed = await db
    .insert(notificationSends)
    .values({ userId, kind, ref })
    .onConflictDoNothing()
    .returning({ userId: notificationSends.userId });
  return claimed.length > 0;
}

/** Gives a claim back after a failed send, so tomorrow's run tries again. */
export async function releaseNotificationSend(userId: string, kind: NotificationKind, ref: string): Promise<void> {
  await db
    .delete(notificationSends)
    .where(and(eq(notificationSends.userId, userId), eq(notificationSends.kind, kind), eq(notificationSends.ref, ref)));
}

/** How many notifications went out since 00:00 UTC; the daily limit counts against this. */
export async function countNotificationSendsToday(now: Date): Promise<number> {
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const [row] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(notificationSends)
    .where(gte(notificationSends.sentAt, startOfDay));
  return row?.total ?? 0;
}

/** Daily cleanup of old rows. Returns how many were removed. */
export async function pruneNotificationSends(): Promise<number> {
  const removed = await db
    .delete(notificationSends)
    .where(lt(notificationSends.sentAt, sql`now() - interval '1 day' * ${NOTIFICATION_SENDS_RETENTION_DAYS}`))
    .returning({ userId: notificationSends.userId });
  return removed.length;
}
