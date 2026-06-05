import type { TimetableStage } from '@/db/actions/festivals'

// Minutes in a standard day — used to normalise overnight end times.
const MINUTES_PER_DAY = 1440

/**
 * Convert an "HH:MM" string to minutes since midnight.
 * "00:00" is returned as MINUTES_PER_DAY (1440) so that midnight-end
 * slots sort and render correctly after any same-day start time.
 */
export function parseTimeToMinutes(time: string): number {
  const [hourStr, minuteStr] = time.split(':')
  const hours = parseInt(hourStr, 10)
  const minutes = parseInt(minuteStr, 10)
  const total = hours * 60 + minutes
  return total === 0 ? MINUTES_PER_DAY : total
}

/**
 * Convert a minute offset back to an "HH:MM" display string.
 * 1440 renders as "00:00".
 */
export function formatMinutesToTime(minutes: number): string {
  const normalised = minutes % MINUTES_PER_DAY
  const hh = String(Math.floor(normalised / 60)).padStart(2, '0')
  const mm = String(normalised % 60).padStart(2, '0')
  return `${hh}:${mm}`
}

export type TimeRange = {
  startMinutes: number
  endMinutes: number
}

/**
 * Scan all stages and slots to find the earliest start time and latest
 * end time across the entire timetable.
 */
export function calculateTimeRange(stages: TimetableStage[]): TimeRange {
  let startMinutes = MINUTES_PER_DAY
  let endMinutes = 0

  for (const stage of stages) {
    for (const slot of stage.slots) {
      const slotStart = parseTimeToMinutes(slot.startTime)
      const slotEnd = parseTimeToMinutes(slot.endTime)
      if (slotStart < startMinutes) startMinutes = slotStart
      if (slotEnd > endMinutes) endMinutes = slotEnd
    }
  }

  return { startMinutes, endMinutes }
}

/**
 * Return the minute values of every full hour within the given range,
 * inclusive of the boundary hours.
 * Example: range 780 (13:00) – 1440 (00:00) → [780, 840, …, 1380, 1440]
 */
export function generateHourMarkers(startMinutes: number, endMinutes: number): number[] {
  const firstHour = Math.ceil(startMinutes / 60) * 60
  const markers: number[] = []

  for (let m = firstHour; m <= endMinutes; m += 60) {
    markers.push(m)
  }

  return markers
}

/**
 * Return the percentage position of `minutes` within the range
 * [rangeStart, rangeEnd]. Used for both block `left`/`width` and
 * hour-marker positions.
 */
export function toPercent(
  minutes: number,
  rangeStart: number,
  rangeEnd: number,
): number {
  const span = rangeEnd - rangeStart
  if (span === 0) return 0
  return ((minutes - rangeStart) / span) * 100
}
