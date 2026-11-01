import { formatDate, formatDateRange } from "@/lib/format-date";
import { MAX_RATING } from "@/lib/constants";
import { renderEmail } from "./layout";

/** Text and HTML bodies of the opt-in notifications. Every one ends with a way to switch it off. */

type Body = { subject: string; text: string; html: string };

export type ReminderDetails = {
  name: string;
  date: string;
  endDate: string | null;
  startTime: string | null;
  place: string | null;
  daysAway: number;
  link: string;
};

export type RecapFestival = { name: string; date: string; rating: number | null };

export type RecapDetails = {
  monthLabel: string;
  festivals: RecapFestival[];
  /** All festivals of the month: `festivals` may show only the first few. */
  totalCount: number;
  averageRating: number | null;
  link: string;
};

const FESTIVAL_REMINDER_REASON = "You get this because you turned on festival reminders in your Goodraves profile.";
const MONTHLY_RECAP_REASON = "You get this because you turned on the monthly recap in your Goodraves profile.";

/** Festival names come from third-party sources: keep them on one line in a subject. */
function singleLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function describeCountdown(daysAway: number): string {
  if (daysAway <= 0) return "today";
  if (daysAway === 1) return "tomorrow";
  return `in ${daysAway} days`;
}

function reminderDetailLines(details: ReminderDetails): string[] {
  const lines = [formatDateRange(details.date, details.endDate, "long")];
  if (details.startTime) lines.push(`Starts ${details.startTime}`);
  if (details.place) lines.push(details.place);
  return lines;
}

export function buildReminderEmail(details: ReminderDetails, unsubscribeUrl: string): Body {
  const name = singleLine(details.name);
  const countdown = describeCountdown(details.daysAway);
  return {
    subject: `${name} is ${countdown}`,
    ...renderEmail({
      heading: `${name} is ${countdown}`,
      intro: "Your next festival is coming up. Check the lineup, the timetable and who else is going.",
      details: reminderDetailLines(details),
      button: { label: "Open the festival", link: details.link },
      outro: "Have a great one.",
      unsubscribe: { reason: FESTIVAL_REMINDER_REASON, url: unsubscribeUrl },
    }),
  };
}

function describeRecapFestival(festival: RecapFestival): string {
  const rating = festival.rating ? ` · ${festival.rating}/${MAX_RATING}` : "";
  return `${singleLine(festival.name)} (${formatDate(festival.date)})${rating}`;
}

function describeRecapIntro(details: RecapDetails): string {
  const count = details.totalCount === 1 ? "1 festival" : `${details.totalCount} festivals`;
  const average = details.averageRating === null ? "" : ` Your average rating: ${details.averageRating.toFixed(1)}/${MAX_RATING}.`;
  return `In ${details.monthLabel} you went to ${count}.${average}`;
}

export function buildRecapEmail(details: RecapDetails, unsubscribeUrl: string): Body {
  const hiddenCount = details.totalCount - details.festivals.length;
  const lines = details.festivals.map(describeRecapFestival);
  if (hiddenCount > 0) lines.push(`and ${hiddenCount} more`);
  return {
    subject: `Your ${details.monthLabel} in raves`,
    ...renderEmail({
      heading: `Your ${details.monthLabel}`,
      intro: describeRecapIntro(details),
      details: lines,
      button: { label: "See your stats", link: details.link },
      outro: "Add your ratings and notes while they are still fresh.",
      unsubscribe: { reason: MONTHLY_RECAP_REASON, url: unsubscribeUrl },
    }),
  };
}
