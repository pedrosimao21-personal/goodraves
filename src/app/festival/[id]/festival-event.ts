import { parseLocalDate } from '@/lib/dates'

const MS_PER_DAY = 86_400_000
const MONOGRAM_WORDS = 2
const SOURCE_PREFIX_LENGTH = 3 // 'ra-', 'ff-', 'pf-'

/** The festival as this page renders it. */
export type FestivalEvent = Record<string, any>

/** Transform a DB festival row into the page's event shape. */
export function transformDbFestival(dbFestival: any): FestivalEvent {
  return {
    id: dbFestival.id,
    name: dbFestival.name,
    date: dbFestival.date,
    endDate: dbFestival.endDate,
    venue: dbFestival.venue ? { name: dbFestival.venue, city: dbFestival.location ?? '' } : undefined,
    location: dbFestival.location,
    imageUrl: dbFestival.imageUrl,
    interestedCount: dbFestival.interestedCount ?? 0,
    visitorsCount: dbFestival.visitorsCount ?? 0,
    genres: dbFestival.genres ?? [],
    attractions: dbFestival.lineup
      ? dbFestival.lineup.map((a: any) => ({ id: a.id, name: a.name }))
      : [],
  }
}

export type SourceLink = { url: string; name: string }

/** The page on the site this festival was imported from, if any. */
export function getSourceLink(id: string): SourceLink | null {
  if (id.startsWith('ra-')) return { url: `https://ra.co/events/${id.slice(SOURCE_PREFIX_LENGTH)}`, name: 'Resident Advisor' }
  if (id.startsWith('ff-')) return { url: `https://festivalfans.nl/event/${id.slice(SOURCE_PREFIX_LENGTH)}/`, name: 'FestivalFans' }
  if (id.startsWith('pf-')) return { url: `https://partyflock.nl/party/${id.slice(SOURCE_PREFIX_LENGTH)}`, name: 'Partyflock' }
  return null
}

/** Number of calendar days the festival spans (1 for a single-day event). */
export function countFestivalDays(date?: string | null, endDate?: string | null): number {
  if (!date || !endDate || endDate <= date) return 1
  return Math.round((parseLocalDate(endDate).getTime() - parseLocalDate(date).getTime()) / MS_PER_DAY) + 1
}

/** First letters of the first two words, e.g. "Kade Weekender" → "KW". */
export function toMonogram(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, MONOGRAM_WORDS).map((word) => word[0]).join('')
}
