/** Small date helpers shared across the app. */

/** Format a Date as a UTC ISO date string (YYYY-MM-DD). */
export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Parse a YYYY-MM-DD string as LOCAL midnight (not UTC). Use for display and
 * past/future comparisons against the viewer's local clock. This is distinct
 * from toIsoDate/addDays, which operate in UTC — appending 'T00:00:00' (no 'Z')
 * is what makes the Date local, and omitting it would parse as UTC instead.
 */
export function parseLocalDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00`);
}

/** Add `days` to an ISO date string (YYYY-MM-DD) and return the resulting ISO date. */
export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return toIsoDate(date);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days from one ISO date to another (negative when `to` is earlier). UTC, like addDays. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

/** The calendar month before the one `isoDate` is in: first and last day, "YYYY-MM", and "October 2026". */
export function previousMonthOf(isoDate: string): { start: string; end: string; key: string; label: string } {
  const firstOfThisMonth = `${isoDate.slice(0, 7)}-01`;
  const end = addDays(firstOfThisMonth, -1);
  const start = `${end.slice(0, 7)}-01`;
  const label = new Date(`${start}T00:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  return { start, end, key: start.slice(0, 7), label };
}
