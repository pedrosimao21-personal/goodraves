import { useCallback, useMemo } from 'react'
import type { UserDataState } from './user-data-state'

/** Derived read-only accessors for user data state */
export function useUserDataReaders(state: UserDataState) {
  const attendedSet = useMemo(() => new Set(state.attendedFestivals), [state.attendedFestivals])
  const upcomingSet = useMemo(() => new Set(state.upcomingFestivals), [state.upcomingFestivals])

  const isAttended = useCallback((eventId: string) => attendedSet.has(eventId), [attendedSet])
  const isUpcoming = useCallback((eventId: string) => upcomingSet.has(eventId), [upcomingSet])
  const didSeeArtist = useCallback((eventId: string, artistId: string) =>
    (state.seenArtists[eventId] ?? []).includes(artistId),
  [state.seenArtists])
  const getSeenCount = useCallback((eventId: string) => {
    if (!attendedSet.has(eventId) && !upcomingSet.has(eventId)) return 0
    return (state.seenArtists[eventId] ?? []).length
  }, [attendedSet, upcomingSet, state.seenArtists])
  const getRating = useCallback((artistId: string) => state.artistRatings[artistId] ?? 0, [state.artistRatings])
  const getPerformanceRating = useCallback((eventId: string, artistId: string) =>
    state.performanceRatings[`${eventId}::${artistId}`] ?? 0,
  [state.performanceRatings])
  const getFestivalRating = useCallback((eventId: string) =>
    state.festivalRatings?.[eventId] ?? 0,
  [state.festivalRatings])
  const getNotes = useCallback((artistId: string) => state.artistNotes[artistId] ?? '', [state.artistNotes])
  const getFestivalNotes = useCallback((eventId: string) => state.festivalNotes[eventId] ?? '', [state.festivalNotes])
  const getFestivalMeta = useCallback((eventId: string) => {
    return state.festivalMeta[eventId] ?? null
  }, [state.festivalMeta])
  const getArtistMeta = useCallback((artistId: string) => state.artistMeta[artistId] ?? null, [state.artistMeta])

  const getArtistSeenCounts = useCallback(() => {
    const counts: Record<string, { count: number; events: string[] }> = {}
    for (const [eventId, artistIds] of Object.entries(state.seenArtists)) {
      if (!attendedSet.has(eventId) && !upcomingSet.has(eventId)) continue
      for (const artistId of artistIds) {
        if (!counts[artistId]) counts[artistId] = { count: 0, events: [] }
        counts[artistId].count += 1
        counts[artistId].events.push(eventId)
      }
    }
    return counts
  }, [state.seenArtists, attendedSet, upcomingSet])

  const exportData = useCallback(() => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'goodraves-data.json'
    a.click()
    URL.revokeObjectURL(url)
  }, [state])

  return {
    isAttended, isUpcoming, didSeeArtist, getSeenCount,
    getRating, getPerformanceRating, getFestivalRating, getNotes, getFestivalNotes,
    getFestivalMeta, getArtistMeta, getArtistSeenCounts, exportData,
  }
}
