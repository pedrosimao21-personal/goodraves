import { parseLocalDate } from './dates'

/** Returns true if the festival's date is in the past (before today) */
export function isFestivalPast(date: string | undefined | null): boolean {
  if (!date) return true
  return parseLocalDate(date) <= new Date()
}
