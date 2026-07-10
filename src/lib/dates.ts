/** Small UTC date helpers shared by the Partyflock batch jobs (agenda import / refresh). */

/** Format a Date as an ISO date string (YYYY-MM-DD). */
export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Add `days` to an ISO date string (YYYY-MM-DD) and return the resulting ISO date. */
export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return toIsoDate(date);
}
