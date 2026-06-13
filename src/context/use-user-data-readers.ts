import { useCallback, useMemo, useRef, useEffect } from 'react'
import type { UserDataState, B2bSetData } from './user-data-state'

/** Derived read-only accessors for user data state.
 * Uses a ref internally so returned functions are stable across re-renders. */
export function useUserDataReaders(state: UserDataState) {
  const stateRef = useRef(state)
  useEffect(() => { stateRef.current = state })

  const attendedSet = useMemo(() => new Set(state.attendedFestivals), [state.attendedFestivals])
  const upcomingSet = useMemo(() => new Set(state.upcomingFestivals), [state.upcomingFestivals])
  const setsRef = useRef({ attended: attendedSet, upcoming: upcomingSet })
  useEffect(() => { setsRef.current = { attended: attendedSet, upcoming: upcomingSet } })

  // Stable reader functions that never recreate - they read from refs
  const isAttended = useCallback((eventId: string) => setsRef.current.attended.has(eventId), [])
  const isUpcoming = useCallback((eventId: string) => setsRef.current.upcoming.has(eventId), [])
  const didSeeArtist = useCallback((eventId: string, artistId: string) =>
    (stateRef.current.seenArtists[eventId] ?? []).includes(artistId),
  [])
  const getSeenCount = useCallback((eventId: string) => {
    if (!setsRef.current.attended.has(eventId) && !setsRef.current.upcoming.has(eventId)) return 0
    return (stateRef.current.seenArtists[eventId] ?? []).length
  }, [])
  const getRating = useCallback((artistId: string) => stateRef.current.artistRatings[artistId] ?? 0, [])
  const getPerformanceRating = useCallback((eventId: string, artistId: string) =>
    stateRef.current.performanceRatings[`${eventId}::${artistId}`] ?? 0,
  [])
  const getFestivalRating = useCallback((eventId: string) =>
    stateRef.current.festivalRatings?.[eventId] ?? 0,
  [])
  const getNotes = useCallback((artistId: string) => stateRef.current.artistNotes[artistId] ?? '', [])
  const getFestivalNotes = useCallback((eventId: string) => stateRef.current.festivalNotes[eventId] ?? '', [])
  const getFestivalMeta = useCallback((eventId: string) => {
    return stateRef.current.festivalMeta[eventId] ?? null
  }, [])
  const getArtistMeta = useCallback((artistId: string) => stateRef.current.artistMeta[artistId] ?? null, [])

  const getArtistSeenCounts = useCallback(() => {
    const s = stateRef.current
    const attended = setsRef.current.attended
    const upcoming = setsRef.current.upcoming
    const counts: Record<string, { count: number; events: string[] }> = {}
    for (const [eventId, artistIds] of Object.entries(s.seenArtists)) {
      if (!attended.has(eventId) && !upcoming.has(eventId)) continue
      for (const artistId of artistIds) {
        if (!counts[artistId]) counts[artistId] = { count: 0, events: [] }
        counts[artistId].count += 1
        counts[artistId].events.push(eventId)
      }
    }
    return counts
  }, [])

  const getAverageArtistRating = useCallback((artistId: string) => {
    const ratings: number[] = []
    for (const [key, value] of Object.entries(stateRef.current.performanceRatings)) {
      if (!value) continue
      const keyArtistId = key.split('::')[1]
      if (keyArtistId === artistId) ratings.push(value)
    }
    if (ratings.length === 0) return 0
    return ratings.reduce((sum, r) => sum + r, 0) / ratings.length
  }, [])

  const getB2bSets = useCallback((festivalId: string): B2bSetData[] =>
    stateRef.current.b2bSets[festivalId] ?? [],
  [])

  const exportData = useCallback(() => {
    const blob = new Blob([JSON.stringify(stateRef.current, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'goodraves-data.json'
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  return useMemo(() => ({
    isAttended, isUpcoming, didSeeArtist, getSeenCount,
    getRating, getPerformanceRating, getFestivalRating, getAverageArtistRating,
    getNotes, getFestivalNotes, getFestivalMeta, getArtistMeta, getArtistSeenCounts, exportData,
    getB2bSets,
  }), [])
}
