import React, { createContext, useContext, useReducer, useEffect } from 'react'
import RA_STATIC_EVENTS from '../data/ra-events'

const STORAGE_KEY = 'festival_tracker_v1'

const defaultState = {
  attendedFestivals: [],     // string[] of event IDs (past attended)
  upcomingFestivals: [],     // string[] of event IDs (going / future)
  festivalMeta: {},          // { eventId: { name, date, venue, image } }
  seenArtists: {},           // { eventId: string[] of attraction IDs }
  artistMeta: {},            // { artistId: { name, image } }
  artistRatings: {},         // { artistId: number 1-5 }       ← global DJ rating (legacy)
  performanceRatings: {},    // { "eventId::artistId": number 1-5 } ← per-festival rating
  artistNotes: {},           // { artistId: string }
  raEvents: {},              // { raId: { name, date, venue, city, lineup, link } }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const saved = raw ? JSON.parse(raw) : {}
    return {
      ...defaultState,
      ...saved,
      raEvents: { ...RA_STATIC_EVENTS, ...(saved.raEvents ?? {}) },
    }
  } catch {
    return { ...defaultState, raEvents: { ...RA_STATIC_EVENTS } }
  }
}

function reducer(state, action) {
  switch (action.type) {
    case 'TOGGLE_ATTENDED': {
      const { id, meta } = action.payload
      const attended = state.attendedFestivals.includes(id)
        ? state.attendedFestivals.filter(x => x !== id)
        : [...state.attendedFestivals, id]
      // Also ensure it's removed from upcoming when moved to attended
      const upcoming = state.upcomingFestivals.filter(x => x !== id)
      const festivalMeta = { ...state.festivalMeta }
      if (!state.attendedFestivals.includes(id) && meta) {
        festivalMeta[id] = meta
      }
      if (state.attendedFestivals.includes(id)) {
        delete festivalMeta[id]
      }
      return { ...state, attendedFestivals: attended, upcomingFestivals: upcoming, festivalMeta }
    }
    case 'TOGGLE_UPCOMING': {
      const { id, meta } = action.payload
      const upcoming = state.upcomingFestivals.includes(id)
        ? state.upcomingFestivals.filter(x => x !== id)
        : [...state.upcomingFestivals, id]
      // Also ensure it's removed from attended when moved to upcoming
      const attended = state.attendedFestivals.filter(x => x !== id)
      const festivalMeta = { ...state.festivalMeta }
      if (!state.upcomingFestivals.includes(id) && meta) {
        festivalMeta[id] = meta
      }
      if (state.upcomingFestivals.includes(id)) {
        delete festivalMeta[id]
      }
      return { ...state, upcomingFestivals: upcoming, attendedFestivals: attended, festivalMeta }
    }
    case 'TOGGLE_SAW_ARTIST': {
      const { eventId, artistId, artistMeta } = action.payload
      const current = state.seenArtists[eventId] ?? []
      const saw = current.includes(artistId)
        ? current.filter(x => x !== artistId)
        : [...current, artistId]
      const newArtistMeta = { ...state.artistMeta }
      if (!current.includes(artistId) && artistMeta) {
        newArtistMeta[artistId] = artistMeta
      }
      return { ...state, seenArtists: { ...state.seenArtists, [eventId]: saw }, artistMeta: newArtistMeta }
    }
    case 'SET_RATING': {
      const { artistId, rating } = action.payload
      return { ...state, artistRatings: { ...state.artistRatings, [artistId]: rating } }
    }
    case 'SET_PERFORMANCE_RATING': {
      const { eventId, artistId, rating } = action.payload
      const key = `${eventId}::${artistId}`
      return { ...state, performanceRatings: { ...state.performanceRatings, [key]: rating } }
    }
    case 'SET_NOTES': {
      const { artistId, notes } = action.payload
      return { ...state, artistNotes: { ...state.artistNotes, [artistId]: notes } }
    }
    case 'BATCH_IMPORT_RA': {
      const { events } = action.payload
      return { ...state, raEvents: { ...state.raEvents, ...events } }
    }
    case 'CLEAR_IMPORTED_RA': {
      return { ...state, raEvents: {} }
    }
    case 'IMPORT_DATA': {
      return { 
        ...defaultState, 
        ...action.payload, 
        raEvents: { ...RA_STATIC_EVENTS, ...(action.payload.raEvents ?? {}) } 
      }
    }
    default:
      return state
  }
}

const UserDataContext = createContext(null)

export function UserDataProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  const toggleAttended = (eventId, meta = null) =>
    dispatch({ type: 'TOGGLE_ATTENDED', payload: { id: eventId, meta } })
  const toggleUpcoming = (eventId, meta = null) =>
    dispatch({ type: 'TOGGLE_UPCOMING', payload: { id: eventId, meta } })
  const toggleSawArtist = (eventId, artistId, artistMeta = null) =>
    dispatch({ type: 'TOGGLE_SAW_ARTIST', payload: { eventId, artistId, artistMeta } })
  const setRating = (artistId, rating) =>
    dispatch({ type: 'SET_RATING', payload: { artistId, rating } })
  const setPerformanceRating = (eventId, artistId, rating) =>
    dispatch({ type: 'SET_PERFORMANCE_RATING', payload: { eventId, artistId, rating } })
  const setNotes = (artistId, notes) =>
    dispatch({ type: 'SET_NOTES', payload: { artistId, notes } })
  const batchImportRA = (events) =>
    dispatch({ type: 'BATCH_IMPORT_RA', payload: { events } })
  const clearImportedRA = () =>
    dispatch({ type: 'CLEAR_IMPORTED_RA' })
  const importData = (data) =>
    dispatch({ type: 'IMPORT_DATA', payload: data })

  const isAttended = (eventId) => state.attendedFestivals.includes(eventId)
  const isUpcoming = (eventId) => state.upcomingFestivals.includes(eventId)
  const didSeeArtist = (eventId, artistId) =>
    (state.seenArtists[eventId] ?? []).includes(artistId)
  const getSeenCount = (eventId) => (state.seenArtists[eventId] ?? []).length
  const getRating = (artistId) => state.artistRatings[artistId] ?? 0
  const getPerformanceRating = (eventId, artistId) =>
    state.performanceRatings[`${eventId}::${artistId}`] ?? 0
  const getNotes = (artistId) => state.artistNotes[artistId] ?? ''
  const getFestivalMeta = (eventId) => {
    if (eventId.startsWith('ra-')) {
      return state.raEvents[eventId] ?? null
    }
    return state.festivalMeta[eventId] ?? null
  }
  const getArtistMeta = (artistId) => state.artistMeta[artistId] ?? null

  const getArtistSeenCounts = () => {
    const counts = {}
    for (const [eventId, artistIds] of Object.entries(state.seenArtists)) {
      for (const artistId of artistIds) {
        if (!counts[artistId]) {
          counts[artistId] = { count: 0, events: [] }
        }
        counts[artistId].count += 1
        counts[artistId].events.push(eventId)
      }
    }
    return counts
  }

  const exportData = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'goodraves-data.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <UserDataContext.Provider
      value={{
        ...state,
        toggleAttended,
        toggleUpcoming,
        toggleSawArtist,
        setRating,
        setPerformanceRating,
        setNotes,
        isAttended,
        isUpcoming,
        didSeeArtist,
        getSeenCount,
        getRating,
        getPerformanceRating,
        getNotes,
        getFestivalMeta,
        getArtistMeta,
        getArtistSeenCounts,
        exportData,
        importData,
        batchImportRA,
        clearImportedRA,
      }}
    >
      {children}
    </UserDataContext.Provider>
  )
}

export function useUserData() {
  const ctx = useContext(UserDataContext)
  if (!ctx) throw new Error('useUserData must be used within UserDataProvider')
  return ctx
}
