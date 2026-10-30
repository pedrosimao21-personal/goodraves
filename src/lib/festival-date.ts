import { parseLocalDate } from './dates'
import { DAY_ENDS_AT_HOUR } from './event-schedule'

/** Where a festival stands against the viewer's local calendar day. */
export type FestivalPhase = 'upcoming' | 'ongoing' | 'past'

/** When `isoDate` is over: noon the next day, so a night that runs past midnight is still on. */
function endOfDay(isoDate: string): Date {
  const day = parseLocalDate(isoDate)
  day.setDate(day.getDate() + 1)
  day.setHours(DAY_ENDS_AT_HOUR)
  return day
}

/**
 * Upcoming before its first day, ongoing from local midnight of the first day
 * through the last day (`endDate`, or `date` for a one-day event) and the night
 * after it, until noon the next day, past from then on. A festival without a
 * date counts as past, so it lands in the user's history rather than their plans.
 */
export function getFestivalPhase(
  date: string | undefined | null,
  endDate?: string | null,
  now: Date = new Date(),
): FestivalPhase {
  if (!date) return 'past'
  if (now < parseLocalDate(date)) return 'upcoming'
  return now < endOfDay(endDate || date) ? 'ongoing' : 'past'
}

/** True once the festival's last day, and the night after it, is over. */
export function isFestivalPast(date: string | undefined | null, endDate?: string | null): boolean {
  return getFestivalPhase(date, endDate) === 'past'
}

/** True from the first day through the last day and the night after it. */
export function isFestivalOngoing(date: string | undefined | null, endDate?: string | null): boolean {
  return getFestivalPhase(date, endDate) === 'ongoing'
}
