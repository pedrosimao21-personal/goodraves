import type { TimetableData } from '@/db/actions/festivals'
import { parseLocalDate } from '@/lib/dates'
import { collectStartTimes, findDayStart, toDayRange } from '@/lib/timetable-time'
import { groupSlotsByTime, type SlotGroup } from './timetable-utils'

const MS_PER_MINUTE = 60_000
/** A day counts as live from this long before its first set. */
const LIVE_LEAD_MINUTES = 180
/** Picked sets that ended within this window are offered for rating. */
const RATE_WINDOW_MINUTES = 240

export type LiveSet = {
  group: SlotGroup
  stageName: string
  start: Date
  end: Date
}

/** A minute on a day's axis (see timetable-time.ts) as a device-local Date. */
function toDate(day: string, minutesOnAxis: number): Date {
  return new Date(parseLocalDate(day).getTime() + minutesOnAxis * MS_PER_MINUTE)
}

/** Every slot group of one timetable day with absolute start and end, in time order. */
export function buildLiveSets(timetable: TimetableData, day: string): LiveSet[] {
  const stages = timetable.stagesByDay[day] ?? []
  const dayStart = findDayStart(collectStartTimes(stages))
  return stages
    .flatMap((stage) => groupSlotsByTime(stage.slots).map((group) => {
      const [start, end] = toDayRange(group, dayStart)
      return { group, stageName: stage.stageName, start: toDate(day, start), end: toDate(day, end) }
    }))
    .sort((a, b) => a.start.getTime() - b.start.getTime())
}

/**
 * The timetable day running at `now`: from LIVE_LEAD_MINUTES before its first
 * set until its last set ends (which can be the next morning). Null between days.
 */
export function findLiveDay(timetable: TimetableData, now: Date): string | null {
  return timetable.days.find((day) => {
    const sets = buildLiveSets(timetable, day)
    if (sets.length === 0) return false
    const opens = sets[0].start.getTime() - LIVE_LEAD_MINUTES * MS_PER_MINUTE
    const closes = Math.max(...sets.map((set) => set.end.getTime()))
    return now.getTime() >= opens && now.getTime() < closes
  }) ?? null
}

export function isPicked(set: LiveSet, picked: Set<string>): boolean {
  return set.group.artists.some((artist) => picked.has(artist.artistId))
}

function isPlaying(set: LiveSet, now: Date): boolean {
  return set.start <= now && now < set.end
}

export type LiveState = {
  /** All sets playing now, every stage. */
  onNow: LiveSet[]
  /** The user's picks playing now (more than one is a clash). */
  nowPicks: LiveSet[]
  nextPick: LiveSet | null
  /** Picks that ended within RATE_WINDOW_MINUTES, most recent first. */
  justFinished: LiveSet[]
  /** The day's picks in time order. */
  dayPicks: LiveSet[]
}

export function buildLiveState(sets: LiveSet[], picked: Set<string>, now: Date): LiveState {
  const dayPicks = sets.filter((set) => isPicked(set, picked))
  const rateFrom = now.getTime() - RATE_WINDOW_MINUTES * MS_PER_MINUTE
  return {
    onNow: sets.filter((set) => isPlaying(set, now)),
    nowPicks: dayPicks.filter((set) => isPlaying(set, now)),
    nextPick: dayPicks.find((set) => set.start > now) ?? null,
    justFinished: dayPicks
      .filter((set) => set.end <= now && set.end.getTime() >= rateFrom)
      .sort((a, b) => b.end.getTime() - a.end.getTime()),
    dayPicks,
  }
}

/** Picks on other stages that overlap `set`: the choices a clash leaves. */
export function findClashingPicks(set: LiveSet, dayPicks: LiveSet[]): LiveSet[] {
  return dayPicks.filter((other) => other !== set
    && other.stageName !== set.stageName
    && other.start < set.end && set.start < other.end)
}

/** "21:22" in the device's local time. */
export function formatClock(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

export function setNames(set: LiveSet): string {
  return set.group.artists.map((artist) => artist.artistName).join(' & ')
}

export function minutesBetween(from: Date, to: Date): number {
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / MS_PER_MINUTE))
}
