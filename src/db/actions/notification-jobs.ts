import { daysBetween } from "@/lib/dates";
import { MONTHLY_RECAP_MAX_FESTIVALS } from "@/lib/constants";
import type { NotificationKind } from "@/lib/notification-kinds";
import { buildRecapEmail, buildReminderEmail } from "@/services/email/notification-templates";
import { findDueRecaps, findDueReminders, type DueRecap, type DueReminder } from "./notification-due";

/** One email waiting to go out. `ref` is what it is about (festival id, or "YYYY-MM"), the ledger's key with user and kind. */
export type NotificationJob = {
  userId: string;
  email: string;
  kind: NotificationKind;
  ref: string;
  buildBody: (unsubscribeUrl: string) => { subject: string; text: string; html: string };
};

function toReminderJob(due: DueReminder, today: string, origin: string): NotificationJob {
  const link = `${origin}/festival/${encodeURIComponent(due.festivalId)}`;
  const daysAway = daysBetween(today, due.date);
  return {
    userId: due.userId,
    email: due.email,
    kind: "next_rave_reminder",
    ref: due.festivalId,
    buildBody: (unsubscribeUrl) => buildReminderEmail({ ...due, daysAway, link }, unsubscribeUrl),
  };
}

function averageRating(festivals: DueRecap["festivals"]): number | null {
  const ratings = festivals.map((festival) => festival.rating).filter((rating): rating is number => rating !== null);
  if (ratings.length === 0) return null;
  return ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
}

function toRecapJob(due: DueRecap, origin: string): NotificationJob {
  const details = {
    monthLabel: due.monthLabel,
    festivals: due.festivals.slice(0, MONTHLY_RECAP_MAX_FESTIVALS),
    totalCount: due.festivals.length,
    averageRating: averageRating(due.festivals),
    link: `${origin}/stats`,
  };
  return {
    userId: due.userId,
    email: due.email,
    kind: "monthly_recap",
    ref: due.monthKey,
    buildBody: (unsubscribeUrl) => buildRecapEmail(details, unsubscribeUrl),
  };
}

/** Everything due today, reminders first: a reminder loses its point after the festival, a recap can wait a day. */
export async function collectNotificationJobs(today: string, origin: string): Promise<NotificationJob[]> {
  const [reminders, recaps] = await Promise.all([findDueReminders(today), findDueRecaps(today)]);
  return [...reminders.map((due) => toReminderJob(due, today, origin)), ...recaps.map((due) => toRecapJob(due, origin))];
}
