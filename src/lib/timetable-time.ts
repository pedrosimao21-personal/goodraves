/**
 * Clock times on a festival day. Slots store plain "HH:MM" strings without a
 * date, so a night that runs 22:00–06:00 has sets whose clock time is smaller
 * than the opener's. These helpers place every time on one axis per day:
 * minutes since midnight of the slot date, past 1440 for times after midnight.
 */

export const MINUTES_PER_DAY = 1440
const MINUTES_PER_HOUR = 60

export type MinuteRange = [start: number, end: number]

/** "HH:MM" to minutes since midnight, 0–1439. */
export function toClockMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return (hours * MINUTES_PER_HOUR + minutes) % MINUTES_PER_DAY
}

/**
 * Where the festival day begins: the first set start after the longest quiet
 * stretch on a 24-hour circle. A 12:00–23:00 day starts at 12:00, a
 * 22:00–06:00 night at 22:00, and a round-the-clock marathon at its earliest
 * set. Takes every start time of the day, across all stages.
 */
export function findDayStart(startTimes: string[]): number {
  const starts = [...new Set(startTimes.map(toClockMinutes))].sort((a, b) => a - b)
  if (starts.length === 0) return 0

  let dayStart = starts[0]
  let longestGap = -1
  starts.forEach((start, index) => {
    const previous = index === 0 ? starts[starts.length - 1] - MINUTES_PER_DAY : starts[index - 1]
    const gap = start - previous
    if (gap > longestGap) {
      longestGap = gap
      dayStart = start
    }
  })
  return dayStart
}

/**
 * A set's [start, end) on the day axis. Starts before `dayStart` belong after
 * midnight; the end follows the start by the set's length, so 23:00–01:00
 * runs two hours instead of going negative.
 */
export function toDayRange(slot: { startTime: string; endTime: string }, dayStart: number): MinuteRange {
  const clockStart = toClockMinutes(slot.startTime)
  const start = clockStart < dayStart ? clockStart + MINUTES_PER_DAY : clockStart
  const length = (toClockMinutes(slot.endTime) - clockStart + MINUTES_PER_DAY) % MINUTES_PER_DAY
  return [start, start + length]
}

/** Every start time on one day of a timetable, for `findDayStart`. */
export function collectStartTimes(stages: { slots: { startTime: string }[] }[]): string[] {
  return stages.flatMap((stage) => stage.slots.map((slot) => slot.startTime))
}
