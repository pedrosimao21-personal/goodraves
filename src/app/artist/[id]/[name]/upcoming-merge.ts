import type { ArtistUpcomingFestival } from '@/db/actions/artist-follow-context'
import type { RAUpcomingEvent } from '@/services/ra/client'
import type { GigSet } from '@/db/actions/following-gig-builder'
import { toIsoDate } from '@/lib/dates'

const RA_ID_PREFIX = 'ra-'

export type UpcomingShow = {
  /** Our festival id; RA-only shows use `ra-<event id>`, which the festival page imports on first view. */
  festivalId: string
  name: string
  date: string
  endDate: string | null
  place: string
  sets: GigSet[]
  source: 'Goodraves' | 'Resident Advisor'
}

/** Lowercase letters and digits only, so "Gashouder (Westergas)" and "gashouder" can match. */
function normalizeVenue(venue: string | null | undefined): string {
  return (venue ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function isSameVenue(a: string | null, b: string | null): boolean {
  const left = normalizeVenue(a)
  const right = normalizeVenue(b)
  if (!left || !right) return false
  return left.includes(right) || right.includes(left)
}

/** True when the RA show is already one of our festivals: same RA id, or same venue within its dates. */
function isKnownShow(event: RAUpcomingEvent, ours: ArtistUpcomingFestival[]): boolean {
  return ours.some((festival) => {
    if (festival.festivalId === `${RA_ID_PREFIX}${event.id}`) return true
    const lastDay = festival.endDate ?? festival.date
    return event.date >= festival.date && event.date <= lastDay && isSameVenue(festival.venue, event.venue)
  })
}

function fromOurs(festival: ArtistUpcomingFestival): UpcomingShow {
  return {
    festivalId: festival.festivalId,
    name: festival.name,
    date: festival.date,
    endDate: festival.endDate,
    place: [festival.venue, festival.location].filter(Boolean).join(' · '),
    sets: festival.sets,
    source: 'Goodraves',
  }
}

function fromRa(event: RAUpcomingEvent): UpcomingShow {
  return {
    festivalId: `${RA_ID_PREFIX}${event.id}`,
    name: event.title,
    date: event.date,
    endDate: null,
    place: [event.venue, event.city].filter(Boolean).join(' · '),
    sets: [],
    source: 'Resident Advisor',
  }
}

/**
 * One upcoming list from our lineups and the artist's RA shows, by date. Each
 * show appears once; ours wins, since it carries set times. The stored RA list
 * can be up to a week old, so shows already past are left out.
 */
export function mergeUpcomingShows(
  ours: ArtistUpcomingFestival[],
  raEvents: RAUpcomingEvent[],
  today: string = toIsoDate(new Date()),
): UpcomingShow[] {
  const raOnly = raEvents.filter((event) => event.date >= today && !isKnownShow(event, ours))
  return [...ours.map(fromOurs), ...raOnly.map(fromRa)].sort((a, b) => a.date.localeCompare(b.date))
}
