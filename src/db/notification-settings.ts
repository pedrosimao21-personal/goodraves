import { db } from "@/db";
import { eq, sql } from "drizzle-orm";
import { userNotificationSettings } from "@/db/schema";
import type { NotificationKind } from "@/lib/notification-kinds";

/**
 * Which notifications a user turned on. Plain server module (not `"use server"`):
 * the profile actions and the unsubscribe route both call it.
 */

export type NotificationSettings = Record<NotificationKind, boolean>;

const ALL_OFF: NotificationSettings = { next_rave_reminder: false, monthly_recap: false };

const COLUMN: Record<NotificationKind, "nextRaveReminder" | "monthlyRecap"> = {
  next_rave_reminder: "nextRaveReminder",
  monthly_recap: "monthlyRecap",
};

export async function getNotificationSettings(userId: string): Promise<NotificationSettings> {
  const [row] = await db
    .select({ next_rave_reminder: userNotificationSettings.nextRaveReminder, monthly_recap: userNotificationSettings.monthlyRecap })
    .from(userNotificationSettings)
    .where(eq(userNotificationSettings.userId, userId))
    .limit(1);
  return row ?? ALL_OFF;
}

/** Turns one notification on or off, creating the settings row on first use. */
export async function setNotificationSetting(userId: string, kind: NotificationKind, isEnabled: boolean): Promise<void> {
  const column = COLUMN[kind];
  await db
    .insert(userNotificationSettings)
    .values({ userId, [column]: isEnabled })
    .onConflictDoUpdate({
      target: userNotificationSettings.userId,
      set: { [column]: isEnabled, updatedAt: sql`now()` },
    });
}
