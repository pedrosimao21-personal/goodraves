"use server";

import { requireAuth } from "./festival-helpers";
import { getAccountEmail } from "./account-email";
import { getNotificationSettings, setNotificationSetting, type NotificationSettings } from "@/db/notification-settings";
import { isNotificationKind } from "@/lib/notification-kinds";

export type NotificationOverview = { isEmailConfirmed: boolean; settings: NotificationSettings };

/** The signed-in user's notification switches, and whether there is a confirmed address to send them to. */
export async function getNotificationOverview(): Promise<NotificationOverview> {
  const userId = await requireAuth();
  const [{ isVerified }, settings] = await Promise.all([getAccountEmail(), getNotificationSettings(userId)]);
  return { isEmailConfirmed: isVerified, settings };
}

/** Turns one notification on or off. Switching on needs a confirmed email; switching off never does. */
export async function setMyNotification(kind: string, isEnabled: boolean): Promise<void> {
  const userId = await requireAuth();
  if (!isNotificationKind(kind)) throw new Error("Unknown notification");
  if (isEnabled && !(await getAccountEmail()).isVerified) throw new Error("Confirm your email first");
  await setNotificationSetting(userId, kind, isEnabled);
}
