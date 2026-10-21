'use client'

import { useCallback, useEffect, useState } from 'react'
import { searchFestivalsDB } from '@/db/actions/festival-search'
import { getUserProfile, updateUserProfile } from '@/db/actions/profile'

const TAILORED_COUNT = 5
const LOCAL_CITY_KEY = 'user_location'
const LOCAL_GENRES_KEY = 'user_genres'

export type TailoredFestival = Record<string, any>

/** Comma-separated genres as stored on the account → trimmed, non-empty list. */
export function parseGenres(value: string): string[] {
  return value.split(',').map(g => g.trim()).filter(Boolean)
}

/**
 * Home city and favourite genres from the account, plus festivals matching
 * the first genre. Values still in localStorage from before accounts held
 * them are moved to the account; the local copy is dropped only after the
 * account write succeeds, so a failed save loses nothing.
 */
export function useProfile(isAuthenticated: boolean) {
  const [city, setCity] = useState('')
  const [genres, setGenres] = useState('')
  const [tailored, setTailored] = useState<TailoredFestival[]>([])
  const [tailoredLoading, setTailoredLoading] = useState(false)

  const loadTailored = useCallback((genreList: string) => {
    const firstGenre = parseGenres(genreList)[0]
    if (!firstGenre) {
      setTailored([])
      return
    }
    setTailoredLoading(true)
    searchFestivalsDB(firstGenre)
      .then(res => setTailored(res.slice(0, TAILORED_COUNT)))
      .catch(() => setTailored([]))
      .finally(() => setTailoredLoading(false))
  }, [])

  useEffect(() => {
    if (!isAuthenticated) return

    async function migrate(key: string, field: 'city' | 'favoriteGenres', value: string): Promise<boolean> {
      try {
        await updateUserProfile({ [field]: value })
        localStorage.removeItem(key)
        return true
      } catch (err) {
        console.error(`[profile] Failed to move ${field} to the account; keeping the local copy:`, err)
        return false
      }
    }

    getUserProfile()
      .then(async (profile) => {
        if (!profile) return
        const localCity = localStorage.getItem(LOCAL_CITY_KEY) ?? ''
        const localGenres = localStorage.getItem(LOCAL_GENRES_KEY) ?? ''
        const nextCity = profile.city || localCity
        const nextGenres = profile.favoriteGenres || localGenres

        setCity(nextCity)
        setGenres(nextGenres)
        if (!profile.city && localCity) await migrate(LOCAL_CITY_KEY, 'city', localCity)
        if (!profile.favoriteGenres && localGenres) await migrate(LOCAL_GENRES_KEY, 'favoriteGenres', localGenres)
        loadTailored(nextGenres)
      })
      .catch(() => {
        // The account read failed: show what this browser still has.
        const localGenres = localStorage.getItem(LOCAL_GENRES_KEY) ?? ''
        setCity(localStorage.getItem(LOCAL_CITY_KEY) ?? '')
        setGenres(localGenres)
        loadTailored(localGenres)
      })
  }, [isAuthenticated, loadTailored])

  const saveCity = useCallback(async (value: string) => {
    await updateUserProfile({ city: value })
    setCity(value)
  }, [])

  const saveGenres = useCallback(async (value: string) => {
    await updateUserProfile({ favoriteGenres: value })
    setGenres(value)
    loadTailored(value)
  }, [loadTailored])

  return { city, genres, tailored, tailoredLoading, saveCity, saveGenres }
}
