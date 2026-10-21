'use client'

import { useCallback, useEffect, useState } from 'react'
import { getUserProfile, updateUserProfile } from '@/db/actions/profile'
import { getTailoredFestivals } from '@/db/actions/tailored-festivals'
import type { TailoredResult } from '@/db/actions/tailored-festivals-core'

const LOCAL_CITY_KEY = 'user_location'
const LOCAL_GENRES_KEY = 'user_genres'
const NO_TAILORED: TailoredResult = { festivals: [], isNearCity: false }

/** Comma-separated genres as stored on the account → trimmed, non-empty list. */
export function parseGenres(value: string): string[] {
  return value.split(',').map(g => g.trim()).filter(Boolean)
}

/**
 * Home city and favourite genres from the account, plus upcoming festivals in
 * those genres near that city (getTailoredFestivals). Values still in localStorage from before accounts held
 * them are moved to the account; the local copy is dropped only after the
 * account write succeeds, so a failed save loses nothing.
 */
export function useProfile(isAuthenticated: boolean) {
  const [city, setCity] = useState('')
  const [genres, setGenres] = useState('')
  const [tailored, setTailored] = useState<TailoredResult>(NO_TAILORED)
  const [tailoredLoading, setTailoredLoading] = useState(false)

  const loadTailored = useCallback((genreList: string, homeCity: string) => {
    const genreNames = parseGenres(genreList)
    if (genreNames.length === 0) {
      setTailored(NO_TAILORED)
      return
    }
    setTailoredLoading(true)
    getTailoredFestivals(genreNames, homeCity || null)
      .then(setTailored)
      .catch((err) => {
        // The aside shows its empty message; the profile fields still work.
        console.error('[profile] Failed to load tailored festivals:', err)
        setTailored(NO_TAILORED)
      })
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
        loadTailored(nextGenres, nextCity)
      })
      .catch(() => {
        // The account read failed: show what this browser still has.
        const localGenres = localStorage.getItem(LOCAL_GENRES_KEY) ?? ''
        const localCity = localStorage.getItem(LOCAL_CITY_KEY) ?? ''
        setCity(localCity)
        setGenres(localGenres)
        loadTailored(localGenres, localCity)
      })
  }, [isAuthenticated, loadTailored])

  const saveCity = useCallback(async (value: string) => {
    await updateUserProfile({ city: value })
    setCity(value)
    loadTailored(genres, value)
  }, [genres, loadTailored])

  const saveGenres = useCallback(async (value: string) => {
    await updateUserProfile({ favoriteGenres: value })
    setGenres(value)
    loadTailored(value, city)
  }, [city, loadTailored])

  return { city, genres, tailored, tailoredLoading, saveCity, saveGenres }
}
