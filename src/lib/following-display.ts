import type { FollowingGig, GigSet } from '@/db/actions/following-gig-builder'
import { parseLocalDate } from '@/lib/dates'

export type GigMonthGroup = { monthKey: string; label: string; gigs: FollowingGig[] }

const MONTH_KEY_LENGTH = 7 // "YYYY-MM"

/** Gigs bucketed by start month, keeping the incoming (date) order. */
export function groupGigsByMonth(gigs: FollowingGig[]): GigMonthGroup[] {
  const groups = new Map<string, GigMonthGroup>()
  for (const gig of gigs) {
    const monthKey = gig.date.slice(0, MONTH_KEY_LENGTH)
    let group = groups.get(monthKey)
    if (!group) {
      const label = parseLocalDate(gig.date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      group = { monthKey, label, gigs: [] }
      groups.set(monthKey, group)
    }
    group.gigs.push(gig)
  }
  return [...groups.values()]
}

function normalizePlace(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

/**
 * "Near you" = the profile city appears in the festival's location or venue
 * (same substring rule as getNearbyShows). City-only on purpose: users have
 * no country on file, so a gig one town over won't count.
 */
export function isGigNearCity(gig: FollowingGig, city: string | null): boolean {
  if (!city) return false
  const needle = normalizePlace(city)
  if (needle.length === 0) return false
  const haystacks = [gig.location, gig.venue].filter((v): v is string => Boolean(v))
  return haystacks.some((place) => normalizePlace(place).includes(needle))
}

/** "Sat 23:00–01:00 · Area A"; the weekday only when the festival spans days. */
export function formatGigSet(set: GigSet, isMultiDay: boolean): string {
  const time = `${set.startTime}–${set.endTime}`
  const day = isMultiDay ? `${parseLocalDate(set.slotDate).toLocaleDateString('en-US', { weekday: 'short' })} ` : ''
  return `${day}${time} · ${set.stageName}`
}

/** "Freek", "Freek and Pedro", "Freek, Pedro +2". */
export function formatNameList(names: string[], maxShown = 2): string {
  if (names.length <= 1) return names.join('')
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  const shown = names.slice(0, maxShown).join(', ')
  return `${shown} +${names.length - maxShown}`
}

const NAMED_FRIENDS_AT_MOST = 2

/** "anna going", "tom + jesse going", "anna + 2 going". */
export function describeFriendsGoing(friends: string[]): string {
  if (friends.length <= NAMED_FRIENDS_AT_MOST) return `${friends.join(' + ')} going`
  return `${friends[0]} + ${friends.length - 1} going`
}
