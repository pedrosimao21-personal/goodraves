import { parseLocalDate } from './dates'

/**
 * Returns true if the festival is over. Checks `endDate` when given, so a
 * multi-day festival still reads as upcoming/ongoing on its later days —
 * `date` alone would mark it "past" as soon as day one ends.
 */
export function isFestivalPast(date: string | undefined | null, endDate?: string | null): boolean {
  const effectiveDate = endDate || date
  if (!effectiveDate) return true
  return parseLocalDate(effectiveDate) <= new Date()
}
