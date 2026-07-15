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
