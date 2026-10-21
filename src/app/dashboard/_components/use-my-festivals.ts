'use client'

import { useMemo } from 'react'
import { useUserData } from '@/context/UserDataContext'
import { parseLocalDate } from '@/lib/dates'

const MS_PER_DAY = 86_400_000

export type RatedFestival = { id: string; name: string; date: string | null; rating: number }

function startOfToday(): Date {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today
}

/** Whole days from today until an ISO date (0 = today). */
export function daysUntil(isoDate: string): number {
  return Math.round((parseLocalDate(isoDate).getTime() - startOfToday().getTime()) / MS_PER_DAY)
}

/** The user's festivals sorted for the lists, plus the numbers for the stats strip. */
export function useMyFestivals() {
  const { attendedFestivals, upcomingFestivals, festivalRatings, seenArtists, getFestivalMeta } = useUserData()

  return useMemo(() => {
    const dateOf = (id: string) => getFestivalMeta(id)?.date ?? ''
    const sortedAttended = [...attendedFestivals].sort((a, b) => dateOf(b).localeCompare(dateOf(a)))
    const sortedUpcoming = [...upcomingFestivals].sort((a, b) => dateOf(a).localeCompare(dateOf(b)))

    const ratedFestivals: RatedFestival[] = attendedFestivals
      .map(id => ({ id, meta: getFestivalMeta(id), rating: festivalRatings?.[id] ?? 0 }))
      .filter(f => f.rating > 0)
      .map(f => ({ id: f.id, name: f.meta?.name ?? f.id, date: f.meta?.date ?? null, rating: f.rating }))
      .sort((a, b) => b.rating - a.rating)
    const averageVibe = ratedFestivals.length > 0
      ? ratedFestivals.reduce((sum, f) => sum + f.rating, 0) / ratedFestivals.length
      : 0

    const artistsSeen = new Set(attendedFestivals.flatMap(id => seenArtists[id] ?? [])).size
    const oldestDate = sortedAttended.map(dateOf).filter(Boolean).at(-1)
    const firstYear = oldestDate ? parseLocalDate(oldestDate).getFullYear() : null
    const nextUpcomingId = sortedUpcoming.find(id => dateOf(id)) ?? null
    const nextDate = nextUpcomingId ? dateOf(nextUpcomingId) : null

    return {
      sortedAttended,
      sortedUpcoming,
      ratedFestivals,
      averageVibe,
      artistsSeen,
      firstYear,
      nextUpcomingId,
      daysUntilNext: nextDate ? daysUntil(nextDate) : null,
    }
  }, [attendedFestivals, upcomingFestivals, festivalRatings, seenArtists, getFestivalMeta])
}
