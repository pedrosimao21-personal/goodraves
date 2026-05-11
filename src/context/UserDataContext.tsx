'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useAuthPrompt } from './AuthPromptContext'
import { useUserDataReaders } from './use-user-data-readers'
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
  setGlobalArtistRating,
  setGlobalArtistNotes,
  setFestivalNotes as setFestivalNotesAction,
} from '@/db/actions/festivals'

import type { InitialUserData } from '@/db/actions/get-initial-data'
import type { FestivalMeta, UserDataState, UserDataContextType } from './user-data-state'
import { DEFAULT_STATE, transformDbData, buildUpsertPayload } from './user-data-state'

const UserDataContext = createContext<UserDataContextType | null>(null)

interface UserDataProviderProps {
  children: React.ReactNode
  initialData?: InitialUserData
}

export function UserDataProvider({ children, initialData }: UserDataProviderProps) {
  const { data: session, status } = useSession()
  const userId = (session?.user as any)?.id as string | undefined
  const { promptAuth } = useAuthPrompt()
  const hasInitialData = initialData != null
  const [state, setState] = useState<UserDataState>(() =>
    initialData ? transformDbData(initialData) : DEFAULT_STATE
  )
  const [loaded, setLoaded] = useState(hasInitialData)
  const userIdRef = useRef(userId)

  useEffect(() => {
    if (status === 'loading') return
    if (!userId) {
      setState(DEFAULT_STATE)
      setLoaded(true)
      return
    }
    if (hasInitialData && userId === userIdRef.current && loaded) return
    if (userId === userIdRef.current && loaded) return
    userIdRef.current = userId

    getFullUserData().then((data) => {
      setState(transformDbData(data))
      setLoaded(true)
    })
  }, [userId, status])

  // ── Mutation helpers ──

  const toggleAttended = useCallback(async (eventId: string, meta: any = null) => {
    if (!userId) { promptAuth(); return }
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

    if (isNowAttended) {
      if (meta) await upsertFestival(buildUpsertPayload(eventId, meta))
      await addAttendance(eventId, 'attended')
    } else {
      await removeAttendance(eventId)
    }
  }, [userId, state.attendedFestivals, promptAuth])

  const toggleUpcoming = useCallback(async (eventId: string, meta: any = null) => {
    if (!userId) { promptAuth(); return }
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
      if (meta) await upsertFestival(buildUpsertPayload(eventId, meta))
      await addAttendance(eventId, 'upcoming')
    } else {
      await removeAttendance(eventId)
    }
  }, [userId, state.upcomingFestivals, promptAuth])

  const toggleSawArtist = useCallback(async (eventId: string, artistId: string, artistMeta: any = null) => {
    if (!userId) { promptAuth(); return }
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
  }, [userId, promptAuth])

  const setRating = useCallback(async (artistId: string, rating: number) => {
    if (!userId) { promptAuth(); return }
    setState(prev => ({ ...prev, artistRatings: { ...prev.artistRatings, [artistId]: rating } }))
    await setGlobalArtistRating(artistId, rating)
  }, [userId, promptAuth])

  const setPerformanceRating = useCallback(async (eventId: string, artistId: string, rating: number) => {
    if (!userId) { promptAuth(); return }
    const key = `${eventId}::${artistId}`
    setState(prev => {
      const currentSeen = prev.seenArtists[eventId] ?? []
      const isSeen = currentSeen.includes(artistId)
      let updatedSeen = currentSeen

      if (rating > 0 && !isSeen) {
        updatedSeen = [...currentSeen, artistId]
      } else if (rating === 0 && isSeen) {
        updatedSeen = currentSeen.filter(x => x !== artistId)
      }

      return {
        ...prev,
        performanceRatings: { ...prev.performanceRatings, [key]: rating },
        seenArtists: { ...prev.seenArtists, [eventId]: updatedSeen },
      }
    })
    await rateArtist(eventId, artistId, rating)
  }, [userId, promptAuth])

  const setFestivalRating = useCallback(async (eventId: string, rating: number) => {
    if (!userId) { promptAuth(); return }
    setState(prev => ({ ...prev, festivalRatings: { ...prev.festivalRatings, [eventId]: rating } }))
    await rateFestival(eventId, rating)
  }, [userId, promptAuth])

  const setNotes = useCallback(async (artistId: string, notes: string) => {
    if (!userId) { promptAuth(); return }
    setState(prev => ({ ...prev, artistNotes: { ...prev.artistNotes, [artistId]: notes } }))
    await setGlobalArtistNotes(artistId, notes)
  }, [userId, promptAuth])

  const setFestivalNotes = useCallback(async (eventId: string, notes: string) => {
    if (!userId) { promptAuth(); return }
    setState(prev => ({ ...prev, festivalNotes: { ...prev.festivalNotes, [eventId]: notes } }))
    await setFestivalNotesAction(eventId, notes)
  }, [userId, promptAuth])

  const batchImportRA = useCallback(async (events: Record<string, any>) => {
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
    setState(prev => {
      const festivalMeta = { ...prev.festivalMeta }
      for (const [id, e] of Object.entries(events)) {
        festivalMeta[id] = e
      }
      return { ...prev, festivalMeta }
    })
  }, [])

  const clearImportedRA = useCallback(() => {
    // No-op in DB mode -- RA events live in festivals table
  }, [])

  const batchEnrichArtists = useCallback((metadata: Record<string, any>) => {
    setState(prev => ({ ...prev, artistMeta: { ...prev.artistMeta, ...metadata } }))
  }, [])

  const importData = useCallback((data: any) => {
    console.warn('importData not yet implemented for DB mode')
  }, [])

  const addCustomFestival = useCallback(async (meta: any, lineup: any[] = []) => {
    if (!userId) { promptAuth(); return '' }
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

    return id
  }, [userId, promptAuth])

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
    if (!userId) return
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
    }).catch((err) => {
      console.error('[UserData] Failed to update festival meta:', err)
    })
  }, [userId])

  // ── Read helpers ──

  const readers = useUserDataReaders(state)

  const contextValue = useMemo(() => ({
    ...state,
    loaded,
    toggleAttended, toggleUpcoming, toggleSawArtist,
    setRating, setPerformanceRating, setFestivalRating, setNotes, setFestivalNotes,
    ...readers,
    importData, addCustomFestival, clearFestivals,
    updateFestivalMeta, batchEnrichArtists, batchImportRA, clearImportedRA,
  }), [
    state, loaded,
    toggleAttended, toggleUpcoming, toggleSawArtist,
    setRating, setPerformanceRating, setFestivalRating, setNotes, setFestivalNotes,
    readers,
    importData, addCustomFestival, clearFestivals,
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
