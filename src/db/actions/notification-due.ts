import { db } from "@/db";
import { and, eq, gte, isNotNull, lte, notExists, sql } from "drizzle-orm";
import { festivals, notificationSends, userFestivals, userNotificationSettings, users } from "@/db/schema";
import { addDays, previousMonthOf } from "@/lib/dates";
import { MONTHLY_RECAP_SEND_DAYS, NEXT_RAVE_REMINDER_DAYS_AHEAD } from "@/lib/constants";
import type { NotificationKind } from "@/lib/notification-kinds";

/**
 * What the daily cron still has to send: reminders and recaps that are switched
 * on, for a confirmed address, and not yet in the send ledger. Plain server
 * module (not `"use server"`). `today` is an ISO date (UTC), passed in so tests can pick it.
 */

export type DueReminder = {
  userId: string;
  email: string;
  festivalId: string;
  name: string;
  date: string;
  endDate: string | null;
  startTime: string | null;
  place: string | null;
};

export type DueRecapFestival = { name: string; date: string; rating: number | null };
export type DueRecap = { userId: string; email: string; monthKey: string; monthLabel: string; festivals: DueRecapFestival[] };

/** Rows of `notification_sends` that would make `ref` a repeat for this user and kind. */
function alreadySent(kind: NotificationKind, ref: ReturnType<typeof sql>) {
  return notExists(
    db
      .select({ one: sql`1` })
      .from(notificationSends)
      .where(and(eq(notificationSends.userId, users.id), eq(notificationSends.kind, kind), sql`${notificationSends.ref} = ${ref}`))
  );
}

/** Festivals on a user's list starting within the next few days, one row per user and festival. */
export async function findDueReminders(today: string): Promise<DueReminder[]> {
  const rows = await db
    .select({
      userId: users.id,
      email: users.email,
      festivalId: festivals.id,
      name: festivals.name,
      date: festivals.date,
      endDate: festivals.endDate,
      startTime: festivals.startTime,
      venue: festivals.venue,
      location: festivals.location,
    })
    .from(userNotificationSettings)
    .innerJoin(users, eq(users.id, userNotificationSettings.userId))
    .innerJoin(userFestivals, eq(userFestivals.userId, users.id))
    .innerJoin(festivals, eq(festivals.id, userFestivals.festivalId))
    .where(
      and(
        eq(userNotificationSettings.nextRaveReminder, true),
        isNotNull(users.email),
        isNotNull(users.emailVerifiedAt),
        gte(festivals.date, today),
        lte(festivals.date, addDays(today, NEXT_RAVE_REMINDER_DAYS_AHEAD)),
        alreadySent("next_rave_reminder", sql`${festivals.id}`)
      )
    )
    .orderBy(festivals.date, users.id);

  return rows.map((row) => ({
    userId: row.userId,
    email: row.email ?? "",
    festivalId: row.festivalId,
    name: row.name,
    date: row.date,
    endDate: row.endDate,
    startTime: row.startTime,
    place: [row.venue, row.location].filter(Boolean).join(", ") || null,
  }));
}

/** On the first days of a month: last month's festivals per user who has the recap on and went to at least one. */
export async function findDueRecaps(today: string): Promise<DueRecap[]> {
  const dayOfMonth = Number(today.slice(8, 10));
  if (dayOfMonth > MONTHLY_RECAP_SEND_DAYS) return [];

  const month = previousMonthOf(today);
  const rows = await db
    .select({
      userId: users.id,
      email: users.email,
      name: festivals.name,
      date: festivals.date,
      rating: userFestivals.rating,
    })
    .from(userNotificationSettings)
    .innerJoin(users, eq(users.id, userNotificationSettings.userId))
    .innerJoin(userFestivals, eq(userFestivals.userId, users.id))
    .innerJoin(festivals, eq(festivals.id, userFestivals.festivalId))
    .where(
      and(
        eq(userNotificationSettings.monthlyRecap, true),
        isNotNull(users.email),
        isNotNull(users.emailVerifiedAt),
        gte(festivals.date, month.start),
        lte(festivals.date, month.end),
        alreadySent("monthly_recap", sql`${month.key}`)
      )
    )
    .orderBy(users.id, festivals.date);

  const byUser = new Map<string, DueRecap>();
  for (const row of rows) {
    const recap = byUser.get(row.userId) ?? { userId: row.userId, email: row.email ?? "", monthKey: month.key, monthLabel: month.label, festivals: [] };
    recap.festivals.push({ name: row.name, date: row.date, rating: row.rating });
    byUser.set(row.userId, recap);
  }
  return [...byUser.values()];
}
