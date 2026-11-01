import { useMemo } from 'react'
import type { UserDataState, B2bSetData, ArtistSetEntry } from './user-data-state'

/** Builds read-only accessors that close over one snapshot of user data state. */
function buildReaders(state: UserDataState, attended: Set<string>, upcoming: Set<string>) {
  const isAttended = (eventId: string) => attended.has(eventId)
  const isUpcoming = (eventId: string) => upcoming.has(eventId)
  const didSeeArtist = (eventId: string, artistId: string) =>
    (state.seenArtists[eventId] ?? []).includes(artistId)
  const didWantToSee = (eventId: string, artistId: string) =>
    (state.wantToSee[eventId] ?? []).includes(artistId)
  const getSeenCount = (eventId: string) => {
    if (!attended.has(eventId) && !upcoming.has(eventId)) return 0
    return (state.seenArtists[eventId] ?? []).length
  }
  const getRating = (artistId: string) => state.artistRatings[artistId] ?? 0
  const getPerformanceRating = (eventId: string, artistId: string) =>
    state.performanceRatings[`${eventId}::${artistId}`] ?? 0
  const getFestivalRating = (eventId: string) => state.festivalRatings?.[eventId] ?? 0
  const getNotes = (artistId: string) => state.artistNotes[artistId] ?? ''
  const getFestivalNotes = (eventId: string) => state.festivalNotes[eventId] ?? ''
  const getFestivalPublicComment = (eventId: string) => state.festivalPublicComments[eventId] ?? ''
  const getFestivalMeta = (eventId: string) => state.festivalMeta[eventId] ?? null
  const getArtistMeta = (artistId: string) => state.artistMeta[artistId] ?? null

  const getArtistSeenCounts = () => {
    const counts: Record<string, { count: number; events: string[] }> = {}
    for (const [eventId, artistIds] of Object.entries(state.seenArtists)) {
      if (!attended.has(eventId) && !upcoming.has(eventId)) continue
      for (const artistId of artistIds) {
        if (!counts[artistId]) counts[artistId] = { count: 0, events: [] }
        counts[artistId].count += 1
        counts[artistId].events.push(eventId)
      }
    }
    return counts
  }

  /** Average of the user's set ratings for the artist, over festivals on their lists (as in getArtistHistory). */
  const getAverageArtistRating = (artistId: string) => {
    const ratings: number[] = []
    for (const [key, value] of Object.entries(state.performanceRatings)) {
      if (!value) continue
      const [eventId, keyArtistId] = key.split('::')
      if (keyArtistId !== artistId) continue
      if (attended.has(eventId) || upcoming.has(eventId)) ratings.push(value)
    }
    if (ratings.length === 0) return 0
    return ratings.reduce((sum, r) => sum + r, 0) / ratings.length
  }

  /** Every festival on the user's lists where they saw the artist, newest first. */
  const getArtistHistory = (artistId: string): ArtistSetEntry[] =>
    Object.entries(state.seenArtists)
      .filter(([eventId, artistIds]) => (attended.has(eventId) || upcoming.has(eventId)) && artistIds.includes(artistId))
      .map(([eventId]) => ({
        festivalId: eventId,
        name: state.festivalMeta[eventId]?.name ?? eventId,
        date: state.festivalMeta[eventId]?.date ?? null,
        rating: state.performanceRatings[`${eventId}::${artistId}`] ?? 0,
      }))
      .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))

  const getB2bSets = (festivalId: string): B2bSetData[] => state.b2bSets[festivalId] ?? []

  const getB2bSetRating = (b2bSetId: string): number => state.b2bSetRatings[b2bSetId] ?? 0

  const exportData = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'goodraves-data.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  return {
    isAttended, isUpcoming, didSeeArtist, didWantToSee, getSeenCount,
    getRating, getPerformanceRating, getFestivalRating, getAverageArtistRating,
    getNotes, getFestivalNotes, getFestivalPublicComment, getFestivalMeta, getArtistMeta, getArtistSeenCounts, exportData,
    getB2bSets, getB2bSetRating, getArtistHistory,
  }
}

/** Derived read-only accessors for user data state.
 *
 * The readers close over the current `state` and are rebuilt whenever it
 * changes, so a component calling them during render always sees the state
 * it is rendering with. Don't move them back to refs synced in an effect:
 * effects run after render, so readers called on the render where data first
 * arrives would return the previous state.
 *
 * Rebuilding on `state` also gives the returned object a new identity per
 * state change, which UserDataContext spreads into UserDataActionsContext's
 * value. That is what makes memo'd list items (FestivalCard, ArtistCard, ...)
 * that only subscribe via useUserDataActions() re-render on a state change;
 * with a never-changing value React would skip them. Reader functions changing
 * identity also invalidates consumers' `useMemo`s that list them as deps. */
export function useUserDataReaders(state: UserDataState) {
  const attendedSet = useMemo(() => new Set(state.attendedFestivals), [state.attendedFestivals])
  const upcomingSet = useMemo(() => new Set(state.upcomingFestivals), [state.upcomingFestivals])
  return useMemo(() => buildReaders(state, attendedSet, upcomingSet), [state, attendedSet, upcomingSet])
}
