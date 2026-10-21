import { parseLocalDate } from './dates'

/** Where a festival stands against the viewer's local calendar day. */
export type FestivalPhase = 'upcoming' | 'ongoing' | 'past'

/** Local midnight at the start of the day after `isoDate`. */
function startOfNextDay(isoDate: string): Date {
  const day = parseLocalDate(isoDate)
  day.setDate(day.getDate() + 1)
  return day
}

/**
 * Upcoming before its first day, ongoing from local midnight of the first day
 * through the whole last day (`endDate`, or `date` for a one-day event), past
 * from midnight after that. A festival without a date counts as past, so it
 * lands in the user's history rather than their plans.
 */
export function getFestivalPhase(
  date: string | undefined | null,
  endDate?: string | null,
  now: Date = new Date(),
): FestivalPhase {
  if (!date) return 'past'
  if (now < parseLocalDate(date)) return 'upcoming'
  return now < startOfNextDay(endDate || date) ? 'ongoing' : 'past'
}

/** True once the festival's last day is over. */
export function isFestivalPast(date: string | undefined | null, endDate?: string | null): boolean {
  return getFestivalPhase(date, endDate) === 'past'
}

/** True from the first day through the last day, inclusive. */
export function isFestivalOngoing(date: string | undefined | null, endDate?: string | null): boolean {
  return getFestivalPhase(date, endDate) === 'ongoing'
}
