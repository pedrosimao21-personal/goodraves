import { buildIcsSetsCalendar, downloadIcsFile, type IcsSet } from '@/lib/ics'
import type { ScheduleDay, ScheduleSet } from './schedule-builder'

type FestivalInfo = { id: string; name: string; venue?: string | null }

function setsOf(day: ScheduleDay): ScheduleSet[] {
  return day.items.flatMap((item) => {
    if (item.kind === 'set') return [item.set]
    if (item.kind === 'clash') return item.sets
    return []
  })
}

function toIcsSet(festival: FestivalInfo, day: string, set: ScheduleSet): IcsSet {
  const names = set.artists.map((artist) => artist.artistName).join(' & ')
  return {
    uid: `${festival.id}-${day}-${set.stageName}-${set.range[0]}`.replace(/[^\w-]/g, ''),
    title: `${names} · ${festival.name}`,
    date: day,
    startMinutes: set.range[0],
    endMinutes: set.range[1],
    location: [set.stageName, festival.venue].filter(Boolean).join(', '),
    festivalId: festival.id,
  }
}

function toFilename(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'festival'
}

/** Download every picked set as a timed calendar event, one .ics file. */
export function exportScheduleToCalendar(festival: FestivalInfo, days: ScheduleDay[]): void {
  const sets = days.flatMap((day) => setsOf(day).map((set) => toIcsSet(festival, day.day, set)))
  downloadIcsFile(`${toFilename(festival.name)}-schedule.ics`, buildIcsSetsCalendar(sets))
}
