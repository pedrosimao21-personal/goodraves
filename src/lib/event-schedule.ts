import { addDays } from "./dates";

/**
 * A night out belongs to the day it started: a party running Saturday 16:00 to
 * Sunday 04:00 is a one-day event, not a two-day one. Anything that ends at or
 * before this hour counts towards the previous day.
 */
export const DAY_ENDS_AT_HOUR = 12;

const DAY_ENDS_AT = `${String(DAY_ENDS_AT_HOUR).padStart(2, "0")}:00`;

export type EventSchedule = {
  /** First day, YYYY-MM-DD. */
  date: string;
  /** Last day when it is later than `date`, else null (a one-day event). */
  endDate: string | null;
  /** Local wall-clock times, HH:MM, as announced. */
  startTime: string | null;
  endTime: string | null;
};

/**
 * Reads RA's timestamps ("2024-12-21T16:00:00.000", venue-local wall time with no
 * zone) by their characters, not through Date, so the result doesn't shift with
 * the server's time zone.
 */
function splitTimestamp(value: string | null | undefined): { day: string; time: string } | null {
  const match = value?.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/);
  return match ? { day: match[1], time: match[2] } : null;
}

/** Days and times of an event from its start and end timestamps. Null when there is no start. */
export function deriveEventSchedule(startTimestamp: string | null | undefined, endTimestamp: string | null | undefined): EventSchedule | null {
  const start = splitTimestamp(startTimestamp);
  if (!start) return null;
  const end = splitTimestamp(endTimestamp);

  let lastDay = end?.day ?? start.day;
  // The morning after belongs to the night before.
  if (end && end.time <= DAY_ENDS_AT && lastDay > start.day) lastDay = addDays(lastDay, -1);

  return {
    date: start.day,
    endDate: lastDay > start.day ? lastDay : null,
    startTime: start.time,
    endTime: end?.time ?? null,
  };
}

/** RA stores 00:00 – 00:00 for events whose hours were never announced. */
export function hasAnnouncedTimes(startTime?: string | null, endTime?: string | null): boolean {
  return Boolean(startTime) && !(startTime === "00:00" && (!endTime || endTime === "00:00"));
}

/** An event's real start and end moments, as local wall-clock days and times. */
export type EventSpan = { startDay: string; startTime: string; endDay: string; endTime: string };

/**
 * Undoes the "a night belongs to the day it started" rule to get when the event
 * really ends, for a calendar entry. Null unless both times were announced.
 * `endDate` is the last day by that rule, so an end at or before noon is the
 * morning after it; a one-day event ends the next day when its end time is not
 * after its start time (16:00 – 04:00, or 23:00 – 00:00).
 */
export function deriveEventSpan(
  date: string,
  endDate: string | null | undefined,
  startTime: string | null | undefined,
  endTime: string | null | undefined,
): EventSpan | null {
  if (!startTime || !endTime || !hasAnnouncedTimes(startTime, endTime)) return null;
  const lastDay = endDate && endDate > date ? endDate : date;
  const runsIntoNextMorning = lastDay > date ? endTime <= DAY_ENDS_AT : endTime <= startTime;
  return { startDay: date, startTime, endDay: runsIntoNextMorning ? addDays(lastDay, 1) : lastDay, endTime };
}
