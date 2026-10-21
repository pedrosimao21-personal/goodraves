import type { TimetableStage, TimetableSlotRow } from '@/db/actions/festivals'
import { MINUTES_PER_DAY, collectStartTimes, findDayStart, toDayRange } from '@/lib/timetable-time'

export type SlotGroup = {
  startTime: string
  endTime: string
  slotOrder: number
  artists: { artistId: string; artistName: string; artistImageUrl: string | null }[]
}

/** Group consecutive rows sharing the same time window into B2B slot groups. */
export function groupSlotsByTime(slots: TimetableSlotRow[]): SlotGroup[] {
  const groups: SlotGroup[] = []

  for (const slot of slots) {
    const last = groups[groups.length - 1]
    const isSameWindow =
      last &&
      last.startTime === slot.startTime &&
      last.endTime === slot.endTime &&
      last.slotOrder === slot.slotOrder

    if (isSameWindow) {
      last.artists.push({ artistId: slot.artistId, artistName: slot.artistName, artistImageUrl: slot.artistImageUrl })
    } else {
      groups.push({
        startTime: slot.startTime,
        endTime: slot.endTime,
        slotOrder: slot.slotOrder,
        artists: [{ artistId: slot.artistId, artistName: slot.artistName, artistImageUrl: slot.artistImageUrl }],
      })
    }
  }

  return groups
}

/**
 * Slot groups in time order on the day axis, so a set after midnight comes
 * after the evening ones. Falls back to the source's slot order on a tie.
 */
export function sortGroupsByStart(groups: SlotGroup[], dayStart: number): SlotGroup[] {
  return [...groups].sort((a, b) =>
    toDayRange(a, dayStart)[0] - toDayRange(b, dayStart)[0] || a.slotOrder - b.slotOrder,
  )
}

/**
 * Convert a minute offset on the day axis back to an "HH:MM" display string.
 * 1440 and later wrap round, so 1500 renders as "01:00".
 */
export function formatMinutesToTime(minutes: number): string {
  const normalised = minutes % MINUTES_PER_DAY
  const hh = String(Math.floor(normalised / 60)).padStart(2, '0')
  const mm = String(normalised % 60).padStart(2, '0')
  return `${hh}:${mm}`
}

export type TimeRange = {
  /** Where the day begins (see findDayStart); slot ranges are relative to it. */
  dayStart: number
  startMinutes: number
  endMinutes: number
}

/**
 * The earliest start and latest end across one day's stages, on the day
 * axis: a night that runs 22:00–06:00 spans 1320–1800.
 */
export function calculateTimeRange(stages: TimetableStage[]): TimeRange {
  const dayStart = findDayStart(collectStartTimes(stages))
  let startMinutes = Infinity
  let endMinutes = -Infinity

  for (const stage of stages) {
    for (const slot of stage.slots) {
      const [slotStart, slotEnd] = toDayRange(slot, dayStart)
      startMinutes = Math.min(startMinutes, slotStart)
      endMinutes = Math.max(endMinutes, slotEnd)
    }
  }

  if (startMinutes > endMinutes) return { dayStart, startMinutes: dayStart, endMinutes: dayStart }
  return { dayStart, startMinutes, endMinutes }
}

/**
 * Return the minute values of every full hour within the given range,
 * inclusive of the boundary hours.
 * Example: range 1320 (22:00) – 1800 (06:00) → [1320, 1380, …, 1740, 1800]
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
