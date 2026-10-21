import type { TimetableData } from '@/db/actions/festival-timetable'
import { type MinuteRange, collectStartTimes, findDayStart, toDayRange } from './timetable-time'

export type ClashSlot = {
  artistId: string
  artistName: string
  stageName: string
  startTime: string
  endTime: string
}

export type Clash = {
  slotDate: string
  a: ClashSlot
  b: ClashSlot
}

function overlaps(a: MinuteRange, b: MinuteRange): boolean {
  return a[0] < b[1] && b[0] < a[1]
}

/**
 * True if two same-day sets overlap in time, including sets after midnight.
 * `dayStart` (see findDayStart) should come from the whole day when known;
 * without it the two sets' own starts are used, which places them correctly
 * relative to each other whenever they are less than 12 hours apart, so
 * every real overlap is still found.
 */
export function doSetsOverlap(
  a: { startTime: string; endTime: string },
  b: { startTime: string; endTime: string },
  dayStart: number = findDayStart([a.startTime, b.startTime]),
): boolean {
  return overlaps(toDayRange(a, dayStart), toDayRange(b, dayStart))
}

/**
 * Find overlapping pairs among the timetable's slots, restricted to the
 * given artist ids (in practice: the ones a user has marked "want to see" —
 * running this over every artist would just report every natural overlap
 * between other stages, which isn't a clash for anyone in particular).
 * Same-day, different-stage, overlapping time ranges only; same stage means
 * it's one continuous set (e.g. a B2B), not two things to choose between.
 */
export function findClashes(timetable: TimetableData, artistIds: Set<string>): Clash[] {
  if (artistIds.size === 0) return []

  const clashes: Clash[] = []

  for (const day of timetable.days) {
    const stages = timetable.stagesByDay[day] ?? []
    const dayStart = findDayStart(collectStartTimes(stages))
    const slots: ClashSlot[] = []
    for (const stage of stages) {
      for (const slot of stage.slots) {
        if (artistIds.has(slot.artistId)) {
          slots.push({ artistId: slot.artistId, artistName: slot.artistName, stageName: stage.stageName, startTime: slot.startTime, endTime: slot.endTime })
        }
      }
    }

    for (let i = 0; i < slots.length; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        const a = slots[i]
        const b = slots[j]
        if (a.stageName === b.stageName) continue
        if (doSetsOverlap(a, b, dayStart)) clashes.push({ slotDate: day, a, b })
      }
    }
  }

  return clashes
}
