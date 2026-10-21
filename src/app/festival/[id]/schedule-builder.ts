import type { TimetableData } from '@/db/actions/festivals'
import { collectStartTimes, findDayStart, toDayRange, type MinuteRange } from '@/lib/timetable-time'
import { groupSlotsByTime, type SlotGroup } from './timetable-utils'

/** Shorter quiet stretches between picks are changeovers, not free time. */
const MIN_FREE_MINUTES = 30

export type ScheduleSet = SlotGroup & { stageName: string; range: MinuteRange }

export type ScheduleItem =
  | { kind: 'set'; set: ScheduleSet }
  | { kind: 'free'; range: MinuteRange }
  | { kind: 'clash'; sets: ScheduleSet[]; overlap: MinuteRange }

export type ScheduleDay = { day: string; pickCount: number; items: ScheduleItem[] }

function overlapOf(a: MinuteRange, b: MinuteRange): MinuteRange | null {
  const start = Math.max(a[0], b[0])
  const end = Math.min(a[1], b[1])
  return start < end ? [start, end] : null
}

/** The stretch where at least two of the sets run at once. */
function spanOfOverlaps(sets: ScheduleSet[]): MinuteRange {
  let start = Infinity
  let end = -Infinity
  sets.forEach((a, i) => sets.slice(i + 1).forEach((b) => {
    const overlap = overlapOf(a.range, b.range)
    if (!overlap) return
    start = Math.min(start, overlap[0])
    end = Math.max(end, overlap[1])
  }))
  return [start, end]
}

/** The day's picked slot groups, in time order on the day axis. */
function collectPickedSets(timetable: TimetableData, day: string, picked: Set<string>): ScheduleSet[] {
  const stages = timetable.stagesByDay[day] ?? []
  const dayStart = findDayStart(collectStartTimes(stages))
  return stages
    .flatMap((stage) => groupSlotsByTime(stage.slots).map((group) => ({
      ...group,
      stageName: stage.stageName,
      range: toDayRange(group, dayStart),
    })))
    .filter((set) => set.artists.some((artist) => picked.has(artist.artistId)))
    .sort((a, b) => a.range[0] - b.range[0] || a.slotOrder - b.slotOrder)
}

/** Runs of sets that overlap each other in time, directly or through a set in between. */
function clusterOverlapping(sets: ScheduleSet[]): ScheduleSet[][] {
  const clusters: ScheduleSet[][] = []
  let clusterEnd = -Infinity
  for (const set of sets) {
    const current = clusters[clusters.length - 1]
    if (current && set.range[0] < clusterEnd) {
      current.push(set)
      clusterEnd = Math.max(clusterEnd, set.range[1])
    } else {
      clusters.push([set])
      clusterEnd = set.range[1]
    }
  }
  return clusters
}

function toItem(cluster: ScheduleSet[]): ScheduleItem {
  if (cluster.length === 1) return { kind: 'set', set: cluster[0] }
  return { kind: 'clash', sets: cluster, overlap: spanOfOverlaps(cluster) }
}

function itemEnd(cluster: ScheduleSet[]): number {
  return Math.max(...cluster.map((set) => set.range[1]))
}

/**
 * One day of the user's schedule: picked sets in time order, free stretches
 * of MIN_FREE_MINUTES or more between them, and overlapping picks grouped as
 * a clash. A B2B slot counts once even when several of its artists are picked.
 */
export function buildScheduleDay(timetable: TimetableData, day: string, picked: Set<string>): ScheduleDay {
  const sets = collectPickedSets(timetable, day, picked)
  const items: ScheduleItem[] = []
  let previousEnd: number | null = null

  for (const cluster of clusterOverlapping(sets)) {
    const start = cluster[0].range[0]
    if (previousEnd !== null && start - previousEnd >= MIN_FREE_MINUTES) {
      items.push({ kind: 'free', range: [previousEnd, start] })
    }
    items.push(toItem(cluster))
    previousEnd = Math.max(previousEnd ?? -Infinity, itemEnd(cluster))
  }

  return { day, pickCount: sets.length, items }
}
