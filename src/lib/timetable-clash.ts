import type { TimetableData } from '@/db/actions/festival-timetable'

const MINUTES_PER_DAY = 1440

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

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

/**
 * [start, end) in minutes past `slotDate`'s midnight. An overnight set (e.g.
 * 23:00 -> 01:00) has its raw end time smaller than its start — push it past
 * MINUTES_PER_DAY rather than treating it as a negative-length slot.
 */
function toRange(slot: { startTime: string; endTime: string }): [number, number] {
  const start = toMinutes(slot.startTime)
  const rawEnd = toMinutes(slot.endTime)
  const end = rawEnd <= start ? rawEnd + MINUTES_PER_DAY : rawEnd
  return [start, end]
}

function overlaps(a: [number, number], b: [number, number]): boolean {
  return a[0] < b[1] && b[0] < a[1]
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
    const slots: ClashSlot[] = []
    for (const stage of timetable.stagesByDay[day] ?? []) {
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
        if (overlaps(toRange(a), toRange(b))) clashes.push({ slotDate: day, a, b })
      }
    }
  }

  return clashes
}
