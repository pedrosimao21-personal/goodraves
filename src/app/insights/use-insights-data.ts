'use client'

import { useMemo } from 'react'
import { useUserData } from '@/context/UserDataContext'
import { normalizeLocation } from '@/utils/location-normalizer'

const GENRES_PER_ARTIST = 4
const TOP_GENRE_COUNT = 6
const TOP_CITY_COUNT = 5

export type AttendedEvent = { id: string; date?: string; [key: string]: any }
export type CountRow = { name: string; count: number }
export type GenreRow = CountRow & { percent: number }

const PERCENT = 100

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** Attended festivals and the per-year, per-city and per-genre counts for Insights. */
export function useInsightsData() {
  const { attendedFestivals, getFestivalMeta, getArtistSeenCounts, artistMeta } = useUserData()

  const attendedEvents = useMemo(() => {
    return attendedFestivals
      .map(id => ({ id, ...(getFestivalMeta(id) || {}) }) as AttendedEvent)
      .filter(e => e.date)
  }, [attendedFestivals, getFestivalMeta])

  const years = useMemo(() => {
    const counts: Record<string, number> = {}
    attendedEvents.forEach(e => {
      const year = e.date!.substring(0, 4)
      counts[year] = (counts[year] || 0) + 1
    })
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [attendedEvents])

  // Genre counts weight each artist by how often you saw them; names are
  // merged case-insensitively. Percent is the share of all genre counts.
  const genres = useMemo((): GenreRow[] => {
    const counts = new Map<string, number>()
    Object.entries(getArtistSeenCounts()).forEach(([artistId, { count }]: [string, any]) => {
      const artistGenres: string[] = artistMeta[artistId]?.genres ?? []
      artistGenres.slice(0, GENRES_PER_ARTIST).forEach(genre => {
        const key = genre.toLowerCase()
        counts.set(key, (counts.get(key) ?? 0) + count)
      })
    })
    const total = [...counts.values()].reduce((sum, c) => sum + c, 0)
    return [...counts]
      .map(([name, count]) => ({ name: capitalize(name), count, percent: total > 0 ? Math.round((count / total) * PERCENT) : 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, TOP_GENRE_COUNT)
  }, [getArtistSeenCounts, artistMeta])

  const cities = useMemo((): CountRow[] => {
    const counts: Record<string, number> = {}
    attendedEvents.forEach(e => {
      const location = normalizeLocation(e.location)
      if (location) counts[location] = (counts[location] || 0) + 1
    })
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
  }, [attendedEvents])

  return { attendedEvents, years, genres, cities, topCities: cities.slice(0, TOP_CITY_COUNT) }
}
