'use client'

import { useMemo } from 'react'
import { useUserData } from '@/context/UserDataContext'

export type SortMode = 'count' | 'rating'

export type RankedFestival = { id: string; name: string; date: string | null }

export type RankedArtist = {
  id: string
  name: string
  image: string | null
  count: number
  avgSetRating: number
  festivals: RankedFestival[]
}

function compareArtists(sortMode: SortMode) {
  return (a: RankedArtist, b: RankedArtist) => {
    if (sortMode === 'rating') {
      // Average rating, then times seen, then name.
      if (b.avgSetRating !== a.avgSetRating) return b.avgSetRating - a.avgSetRating
      if (b.count !== a.count) return b.count - a.count
      return a.name.localeCompare(b.name)
    }
    // Times seen, then rating, then name.
    if (b.count !== a.count) return b.count - a.count
    if (b.avgSetRating !== a.avgSetRating) return b.avgSetRating - a.avgSetRating
    return a.name.localeCompare(b.name)
  }
}

/** Artists you've seen, ranked for the selected year, plus the years that have data. */
export function useTopDjsRanking(selectedYear: string, sortMode: SortMode) {
  const { getArtistSeenCounts, artistMeta, performanceRatings, getFestivalMeta } = useUserData()

  return useMemo(() => {
    const counts = getArtistSeenCounts()
    const years = new Set<string>()

    const list = Object.entries(counts)
      .map(([artistId, { events }]: [string, any]): RankedArtist | null => {
        const meta = artistMeta[artistId]
        const festivals: RankedFestival[] = events.map((eid: string) => {
          const fm = getFestivalMeta(eid)
          return { id: eid, name: fm?.name ?? eid, date: fm?.date ?? null }
        })
        festivals.forEach((f) => { if (f.date) years.add(f.date.substring(0, 4)) })

        const filtered = selectedYear === 'all'
          ? festivals
          : festivals.filter((f) => f.date?.startsWith(selectedYear))
        if (filtered.length === 0) return null

        const ratings = filtered.map((f) => performanceRatings[`${f.id}::${artistId}`]).filter((r) => r > 0)
        const avgSetRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0

        return {
          id: artistId,
          name: meta?.name ?? artistId,
          image: meta?.image ?? null,
          count: filtered.length,
          avgSetRating,
          festivals: filtered.sort((a, b) => (a.date || '').localeCompare(b.date || '')),
        }
      })
      .filter((artist): artist is RankedArtist => artist !== null)
      .sort(compareArtists(sortMode))

    return {
      ranking: list,
      availableYears: [...years].sort((a, b) => b.localeCompare(a)),
    }
  }, [getArtistSeenCounts, artistMeta, performanceRatings, getFestivalMeta, selectedYear, sortMode])
}
