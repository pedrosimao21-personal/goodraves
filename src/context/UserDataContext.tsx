'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useSession } from 'next-auth/react'
import {
  getFullUserData,
  addAttendance,
  removeAttendance,
  rateFestival,
  toggleSawArtist as toggleSawArtistAction,
  rateArtist,
  upsertFestival,
  clearUserFestivals,
  batchImportFestivals,
  searchFestivalsDB,
  getFestival,
  setGlobalArtistRating,
  setGlobalArtistNotes,
} from '@/db/actions/festivals'

import type { InitialUserData } from '@/db/actions/get-initial-data'

interface FestivalMeta {
  name: string
  date: string
  endDate?: string
  venue?: string | { name: string; city?: string }
  location?: string
  latitude?: number
  longitude?: number
  source?: string
  sourceId?: string
  imageUrl?: string | null
  lineup?: string[]
  [key: string]: any
}

interface State {
  attendedFestivals: string[]
  upcomingFestivals: string[]
  festivalMeta: Record<string, FestivalMeta>
  seenArtists: Record<string, string[]>
  artistMeta: Record<string, any>
  artistRatings: Record<string, number>
  performanceRatings: Record<string, number>
  festivalRatings: Record<string, number>
  artistNotes: Record<string, string>
  raEvents: Record<string, any>
}

const defaultState: State = {
  attendedFestivals: [],
  upcomingFestivals: [],
  festivalMeta: {},
  seenArtists: {},
  artistMeta: {},
  artistRatings: {},
  performanceRatings: {},
  festivalRatings: {},
  artistNotes: {},
  raEvents: {},
}

interface UserDataContextType {
  // State
  attendedFestivals: string[]
  upcomingFestivals: string[]
  festivalMeta: Record<string, FestivalMeta>
  seenArtists: Record<string, string[]>
  artistMeta: Record<string, any>
  artistRatings: Record<string, number>
  performanceRatings: Record<string, number>
  festivalRatings: Record<string, number>
  artistNotes: Record<string, string>
  raEvents: Record<string, any>
  loaded: boolean
  // Mutations
  toggleAttended: (eventId: string, meta?: any) => Promise<void>
  toggleUpcoming: (eventId: string, meta?: any) => Promise<void>
  toggleSawArtist: (eventId: string, artistId: string, artistMeta?: any) => Promise<void>
  setRating: (artistId: string, rating: number) => Promise<void>
  setPerformanceRating: (eventId: string, artistId: string, rating: number) => Promise<void>
  setFestivalRating: (eventId: string, rating: number) => Promise<void>
  setNotes: (artistId: string, notes: string) => Promise<void>
  // Reads
  isAttended: (eventId: string) => boolean
  isUpcoming: (eventId: string) => boolean
  didSeeArtist: (eventId: string, artistId: string) => boolean
  getSeenCount: (eventId: string) => number
  getRating: (artistId: string) => number
  getPerformanceRating: (eventId: string, artistId: string) => number
  getFestivalRating: (eventId: string) => number
  getNotes: (artistId: string) => string
  getFestivalMeta: (eventId: string) => FestivalMeta | null
  getArtistMeta: (artistId: string) => any
  getArtistSeenCounts: () => Record<string, { count: number; events: string[] }>
  // Actions
  exportData: () => void
  importData: (data: any) => void
  addCustomFestival: (meta: any, lineup?: any[]) => Promise<string>
  clearFestivals: (type: string) => Promise<void>
  updateFestivalMeta: (id: string, meta: any) => void
  batchEnrichArtists: (metadata: Record<string, any>) => void
  batchImportRA: (events: Record<string, any>) => Promise<void>
  clearImportedRA: () => void
}

const UserDataContext = createContext<UserDataContextType | null>(null)

/** Transform raw DB data into local state shape */
function transformDbData(data: NonNullable<InitialUserData>): State {
  const attended: string[] = []
  const upcoming: string[] = []
  const festivalMeta: Record<string, FestivalMeta> = {}
  const festivalRatings: Record<string, number> = {}
  const seenArtists: Record<string, string[]> = {}
  const performanceRatings: Record<string, number> = {}
  const artistRatings: Record<string, number> = {}
  const artistNotes: Record<string, string> = {}

  const lineupByFestival: Record<string, string[]> = {}
  for (const row of data.lineups) {
    if (!lineupByFestival[row.festivalId]) lineupByFestival[row.festivalId] = []
    lineupByFestival[row.festivalId].push(row.artistName)
  }

  // Build artistId→name map from lineups for later use
  const artistIdToName: Record<string, string> = {}
  for (const row of data.lineups) {
    artistIdToName[row.artistId] = row.artistName
  }

  for (const f of data.festivals) {
    if (f.status === 'attended') attended.push(f.festivalId)
    else upcoming.push(f.festivalId)

    festivalMeta[f.festivalId] = {
      name: f.name,
      date: f.date,
      venue: f.venue ?? undefined,
      location: f.location ?? undefined,
      imageUrl: f.imageUrl,
      source: f.source ?? undefined,
      lineup: lineupByFestival[f.festivalId] ?? [],
    }

    if (f.rating) festivalRatings[f.festivalId] = f.rating
  }

  for (const ar of data.artistRatings) {
    if (!seenArtists[ar.festivalId]) seenArtists[ar.festivalId] = []
    seenArtists[ar.festivalId].push(ar.artistId)
    if (ar.rating) {
      performanceRatings[`${ar.festivalId}::${ar.artistId}`] = ar.rating
    }
  }

  for (const g of data.globalArtistData) {
    if (g.rating) artistRatings[g.artistId] = g.rating
    if (g.notes) artistNotes[g.artistId] = g.notes
  }

  const artistMeta: Record<string, any> = {}
  for (const a of (data.artistGenres ?? [])) {
    artistMeta[a.id] = {
      name: a.name,
      genres: a.genres ? JSON.parse(a.genres) : [],
    }
  }

  return {
    attendedFestivals: attended,
    upcomingFestivals: upcoming,
    festivalMeta,
    seenArtists,
    artistMeta,
    artistRatings,
    performanceRatings,
    festivalRatings,
    artistNotes,
    raEvents: {},
  }
}

interface UserDataProviderProps {
  children: React.ReactNode
  initialData?: InitialUserData
}

export function UserDataProvider({ children, initialData }: UserDataProviderProps) {
  const { data: session, status } = useSession()
  const userId = (session?.user as any)?.id as string | undefined
  const hasInitialData = initialData != null
  const [state, setState] = useState<State>(() =>
    initialData ? transformDbData(initialData) : defaultState
  )
  const [loaded, setLoaded] = useState(hasInitialData)
  const userIdRef = useRef(userId)

  // Load full user data from DB on login (skip if initialData was provided)
  useEffect(() => {
    if (status === 'loading') return
    if (!userId) {
      setState(defaultState)
      setLoaded(true)
      return
    }
    // Skip fetch if we already have server-provided data for this user
    if (hasInitialData && userId === userIdRef.current && loaded) return
    if (userId === userIdRef.current && loaded) return
    userIdRef.current = userId

    getFullUserData().then((data) => {
      setState(transformDbData(data))
      setLoaded(true)
    })
  }, [userId, status])

  // ── Mutation helpers (optimistic + server action) ──

  const toggleAttended = useCallback(async (eventId: string, meta: any = null) => {
    if (!userId) return
    // Compute intent BEFORE optimistic setState to avoid stale closure
    const wasAttended = state.attendedFestivals.includes(eventId)
    const isNowAttended = !wasAttended

    setState(prev => {
      const isAttended = prev.attendedFestivals.includes(eventId)
      const attended = isAttended
        ? prev.attendedFestivals.filter(x => x !== eventId)
        : [...prev.attendedFestivals, eventId]
      const upcoming = prev.upcomingFestivals.filter(x => x !== eventId)
      const festivalMeta = { ...prev.festivalMeta }
      if (!isAttended && meta) festivalMeta[eventId] = meta
      return { ...prev, attendedFestivals: attended, upcomingFestivals: upcoming, festivalMeta }
    })

    // Fire server action
    if (isNowAttended) {
      // Ensure festival exists in DB if it's external
      if (meta) {
        await upsertFestival({
          id: eventId,
          name: meta.name,
          date: meta.date ?? meta.startDate ?? '',
          venue: typeof meta.venue === 'object' ? meta.venue?.name : meta.venue,
          location: meta.location ?? (typeof meta.venue === 'object' ? meta.venue?.city : undefined),
          imageUrl: meta.imageUrl ?? meta.image ?? null,
          source: meta.source ?? (eventId.startsWith('ra-') ? 'ra' : 'external'),
          lineup: meta.lineup?.length ? meta.lineup : undefined,
        })
      }
      await addAttendance(eventId, 'attended')
    } else {
      await removeAttendance(eventId)
    }
  }, [userId, state.attendedFestivals])

  const toggleUpcoming = useCallback(async (eventId: string, meta: any = null) => {
    if (!userId) return
    // Compute intent BEFORE optimistic setState to avoid stale closure
    const wasUpcoming = state.upcomingFestivals.includes(eventId)
    const isNowUpcoming = !wasUpcoming

    setState(prev => {
      const isUpcoming = prev.upcomingFestivals.includes(eventId)
      const upcoming = isUpcoming
        ? prev.upcomingFestivals.filter(x => x !== eventId)
        : [...prev.upcomingFestivals, eventId]
      const attended = prev.attendedFestivals.filter(x => x !== eventId)
      const festivalMeta = { ...prev.festivalMeta }
      if (!isUpcoming && meta) festivalMeta[eventId] = meta
      return { ...prev, upcomingFestivals: upcoming, attendedFestivals: attended, festivalMeta }
    })

    if (isNowUpcoming) {
      if (meta) {
        await upsertFestival({
          id: eventId,
          name: meta.name,
          date: meta.date ?? meta.startDate ?? '',
          venue: typeof meta.venue === 'object' ? meta.venue?.name : meta.venue,
          location: meta.location ?? (typeof meta.venue === 'object' ? meta.venue?.city : undefined),
          imageUrl: meta.imageUrl ?? meta.image ?? null,
          source: meta.source ?? (eventId.startsWith('ra-') ? 'ra' : 'external'),
          lineup: meta.lineup?.length ? meta.lineup : undefined,
        })
      }
      await addAttendance(eventId, 'upcoming')
    } else {
      await removeAttendance(eventId)
    }
  }, [userId, state.upcomingFestivals])

  const toggleSawArtist = useCallback(async (eventId: string, artistId: string, artistMeta: any = null) => {
    if (!userId) return
    setState(prev => {
      const current = prev.seenArtists[eventId] ?? []
      const saw = current.includes(artistId)
        ? current.filter(x => x !== artistId)
        : [...current, artistId]
      const newArtistMeta = { ...prev.artistMeta }
      if (!current.includes(artistId) && artistMeta) newArtistMeta[artistId] = artistMeta
      return { ...prev, seenArtists: { ...prev.seenArtists, [eventId]: saw }, artistMeta: newArtistMeta }
    })

    await toggleSawArtistAction(eventId, artistId)
  }, [userId])

  const setRating = useCallback(async (artistId: string, rating: number) => {
    setState(prev => ({ ...prev, artistRatings: { ...prev.artistRatings, [artistId]: rating } }))
    if (userId) {
      await setGlobalArtistRating(artistId, rating)
    }
  }, [userId])

  const setPerformanceRating = useCallback(async (eventId: string, artistId: string, rating: number) => {
    if (!userId) return
    const key = `${eventId}::${artistId}`
    setState(prev => ({ ...prev, performanceRatings: { ...prev.performanceRatings, [key]: rating } }))
    await rateArtist(eventId, artistId, rating)
  }, [userId])

  const setFestivalRating = useCallback(async (eventId: string, rating: number) => {
    if (!userId) return
    setState(prev => ({ ...prev, festivalRatings: { ...prev.festivalRatings, [eventId]: rating } }))
    await rateFestival(eventId, rating)
  }, [userId])

  const setNotes = useCallback(async (artistId: string, notes: string) => {
    setState(prev => ({ ...prev, artistNotes: { ...prev.artistNotes, [artistId]: notes } }))
    if (userId) {
      await setGlobalArtistNotes(artistId, notes)
    }
  }, [userId])

  const batchImportRA = useCallback(async (events: Record<string, any>) => {
    // Import events into DB
    const eventArray = Object.entries(events).map(([id, e]: [string, any]) => ({
      id,
      name: e.name ?? e.title ?? id,
      date: e.date ?? e.startDate ?? '',
      venue: typeof e.venue === 'object' ? e.venue?.name : e.venue,
      location: e.location ?? (typeof e.venue === 'object' ? e.venue?.city : undefined),
      source: 'ra',
      lineup: e.lineup ?? [],
    }))
    await batchImportFestivals(eventArray)
    // Update local state with the festival meta
    setState(prev => {
      const festivalMeta = { ...prev.festivalMeta }
      for (const [id, e] of Object.entries(events)) {
        festivalMeta[id] = e
      }
      return { ...prev, festivalMeta }
    })
  }, [])

  const clearImportedRA = useCallback(() => {
    // No-op in DB mode — RA events live in festivals table
  }, [])

  const batchEnrichArtists = useCallback((metadata: Record<string, any>) => {
    setState(prev => ({ ...prev, artistMeta: { ...prev.artistMeta, ...metadata } }))
  }, [])

  const importData = useCallback((data: any) => {
    // TODO: implement full import from JSON if needed
    console.warn('importData not yet implemented for DB mode')
  }, [])

  const addCustomFestival = useCallback(async (meta: any, lineup: any[] = []) => {
    const id = 'custom-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7)
    const enrichedMeta = { ...meta, lineup: lineup.map((a: any) => a.name) }

    setState(prev => {
      const festivalMeta = { ...prev.festivalMeta, [id]: enrichedMeta }
      const attended = prev.attendedFestivals.includes(id)
        ? prev.attendedFestivals
        : [...prev.attendedFestivals, id]
      const newArtistMeta = { ...prev.artistMeta }
      lineup.forEach((a: any) => {
        if (!newArtistMeta[a.id]) newArtistMeta[a.id] = { name: a.name, image: null }
      })
      return { ...prev, attendedFestivals: attended, festivalMeta, artistMeta: newArtistMeta }
    })

    if (userId) {
      await upsertFestival({
        id,
        name: meta.name,
        date: meta.date ?? '',
        venue: typeof meta.venue === 'object' ? meta.venue?.name : meta.venue,
        location: meta.location ?? (typeof meta.venue === 'object' ? meta.venue?.city : undefined),
        imageUrl: meta.imageUrl ?? null,
        source: 'custom',
        lineup: lineup.map((a: any) => a.name),
      })
      await addAttendance(id, 'attended')
    }

    return id
  }, [userId])

  const clearFestivals = useCallback(async (type: string) => {
    setState(prev => {
      if (type === 'attended') return { ...prev, attendedFestivals: [] }
      return { ...prev, upcomingFestivals: [] }
    })
    if (userId) {
      await clearUserFestivals(type as 'attended' | 'upcoming')
    }
  }, [userId])

  const updateFestivalMeta = useCallback((id: string, meta: any) => {
    setState(prev => {
      const base = prev.festivalMeta[id] ?? {}
      return { ...prev, festivalMeta: { ...prev.festivalMeta, [id]: { ...base, ...meta } } }
    })
    if (userId) {
      const venueObj = typeof meta.venue === 'object' ? meta.venue : null
      const venueName = venueObj?.name ?? (typeof meta.venue === 'string' ? meta.venue : null)
      const city = venueObj?.city ?? (typeof meta.location === 'string' ? meta.location : null)
      upsertFestival({
        id,
        name: meta.name,
        date: meta.date ?? '',
        venue: venueName,
        location: city,
        imageUrl: meta.imageUrl ?? meta.image ?? null,
        lineup: meta.lineup ?? [],
      }).catch(console.error)
    }
  }, [userId])

  // ── Read helpers ──

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

  const contextValue = useMemo(() => ({
    ...state,
    loaded,
    toggleAttended,
    toggleUpcoming,
    toggleSawArtist,
    setRating,
    setPerformanceRating,
    setFestivalRating,
    setNotes,
    isAttended,
    isUpcoming,
    didSeeArtist,
    getSeenCount,
    getRating,
    getPerformanceRating,
    getFestivalRating,
    getNotes,
    getFestivalMeta,
    getArtistMeta,
    getArtistSeenCounts,
    exportData,
    importData,
    addCustomFestival,
    clearFestivals,
    updateFestivalMeta,
    batchEnrichArtists,
    batchImportRA,
    clearImportedRA,
  }), [
    state, loaded,
    toggleAttended, toggleUpcoming, toggleSawArtist,
    setRating, setPerformanceRating, setFestivalRating, setNotes,
    isAttended, isUpcoming, didSeeArtist, getSeenCount,
    getRating, getPerformanceRating, getFestivalRating, getNotes,
    getFestivalMeta, getArtistMeta, getArtistSeenCounts,
    exportData, importData, addCustomFestival, clearFestivals,
    updateFestivalMeta, batchEnrichArtists, batchImportRA, clearImportedRA,
  ])

  return (
    <UserDataContext.Provider value={contextValue}>
      {children}
    </UserDataContext.Provider>
  )
}

export function useUserData() {
  const ctx = useContext(UserDataContext)
  if (!ctx) throw new Error('useUserData must be used within UserDataProvider')
  return ctx
}
