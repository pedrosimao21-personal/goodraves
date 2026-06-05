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
  setGlobalArtistRating,
  setGlobalArtistNotes,
  setFestivalNotes as setFestivalNotesAction,
  splitB2bArtist as splitB2bArtistAction,
  createB2bSet as createB2bSetAction,
  unsplitB2bSet as unsplitB2bSetAction,
  rateB2bSet as rateB2bSetAction,
  getB2bSetsForFestival,
} from '@/db/actions/festivals'
import { renameArtist as renameArtistAction } from '@/db/actions/artist-rename'
import { ADMIN_USERNAMES } from '@/lib/constants'

import { isFestivalPast } from '@/lib/festival-date'
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
  const username = (session?.user as any)?.name as string | undefined
  const isAdmin = Boolean(username && ADMIN_USERNAMES.includes(username))
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

  const toggleFestival = useCallback(async (eventId: string, meta: any = null) => {
    if (!userId) { promptAuth(); return }

    const isAdded = state.attendedFestivals.includes(eventId) || state.upcomingFestivals.includes(eventId)

    setState(prev => {
      const alreadyAdded = prev.attendedFestivals.includes(eventId) || prev.upcomingFestivals.includes(eventId)
      if (alreadyAdded) {
        return {
          ...prev,
          attendedFestivals: prev.attendedFestivals.filter(x => x !== eventId),
          upcomingFestivals: prev.upcomingFestivals.filter(x => x !== eventId),
        }
      }
      const festivalMeta = meta ? { ...prev.festivalMeta, [eventId]: meta } : prev.festivalMeta
      const date = meta?.date ?? prev.festivalMeta[eventId]?.date
      if (isFestivalPast(date)) {
        return { ...prev, attendedFestivals: [...prev.attendedFestivals, eventId], festivalMeta }
      }
      return { ...prev, upcomingFestivals: [...prev.upcomingFestivals, eventId], festivalMeta }
    })

    if (!isAdded) {
      if (meta) await upsertFestival(buildUpsertPayload(eventId, meta))
      await addAttendance(eventId)
    } else {
      await removeAttendance(eventId)
    }
  }, [userId, state.attendedFestivals, state.upcomingFestivals, promptAuth])

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

  const splitB2bArtist = useCallback(async (festivalId: string, artistId: string, memberNames: string[]) => {
    if (!userId) { promptAuth(); return }
    const result = await splitB2bArtistAction(festivalId, artistId, memberNames)
    setState(prev => {
      const existingSets = prev.b2bSets[festivalId] ?? []
      return {
        ...prev,
        b2bSets: { ...prev.b2bSets, [festivalId]: [...existingSets, result] },
      }
    })
  }, [userId, promptAuth])

  const createB2bSet = useCallback(async (festivalId: string, memberArtistIds: string[]) => {
    if (!userId) { promptAuth(); return }
    const result = await createB2bSetAction(festivalId, memberArtistIds)
    setState(prev => {
      const existingSets = prev.b2bSets[festivalId] ?? []
      return {
        ...prev,
        b2bSets: { ...prev.b2bSets, [festivalId]: [...existingSets, result] },
      }
    })
  }, [userId, promptAuth])

  const unsplitB2bSet = useCallback(async (b2bSetId: string, festivalId: string) => {
    if (!userId) { promptAuth(); return }
    await unsplitB2bSetAction(b2bSetId)
    setState(prev => {
      const existingSets = prev.b2bSets[festivalId] ?? []
      return {
        ...prev,
        b2bSets: {
          ...prev.b2bSets,
          [festivalId]: existingSets.filter(s => s.id !== b2bSetId),
        },
      }
    })
  }, [userId, promptAuth])

  const rateB2bSetFn = useCallback(async (b2bSetId: string, rating: number) => {
    if (!userId) { promptAuth(); return }
    // Optimistically update performance ratings for all members of this B2B set
    setState(prev => {
      const allSets = Object.values(prev.b2bSets).flat()
      const b2bSet = allSets.find(s => s.id === b2bSetId)
      if (!b2bSet) return prev

      const updatedPerformanceRatings = { ...prev.performanceRatings }
      const updatedSeen = { ...prev.seenArtists }
      const currentSeen = updatedSeen[b2bSet.festivalId] ?? []
      let newSeen = [...currentSeen]

      for (const member of b2bSet.members) {
        const key = `${b2bSet.festivalId}::${member.artistId}`
        updatedPerformanceRatings[key] = rating

        if (rating > 0 && !newSeen.includes(member.artistId)) {
          newSeen.push(member.artistId)
        } else if (rating === 0) {
          newSeen = newSeen.filter(id => id !== member.artistId)
        }
      }

      return {
        ...prev,
        performanceRatings: updatedPerformanceRatings,
        seenArtists: { ...updatedSeen, [b2bSet.festivalId]: newSeen },
      }
    })
    await rateB2bSetAction(b2bSetId, rating)
  }, [userId, promptAuth])

  const loadB2bSets = useCallback(async (festivalId: string) => {
    const sets = await getB2bSetsForFestival(festivalId)
    setState(prev => ({
      ...prev,
      b2bSets: { ...prev.b2bSets, [festivalId]: sets },
    }))
  }, [])

  const renameArtist = useCallback(async (festivalId: string, artistId: string, newName: string) => {
    if (!userId) { promptAuth(); return }
    const result = await renameArtistAction(festivalId, artistId, newName)
    setState(prev => {
      const updatedMeta = { ...prev.festivalMeta }
      const festival = updatedMeta[festivalId]
      if (festival?.lineup) {
        // Find the old artist name in the lineup and replace it
        const oldIndex = festival.lineup.findIndex(
          (name: string) => prev.artistMeta[artistId]?.name?.toLowerCase() === name.toLowerCase()
            || name.toLowerCase() === artistId.toLowerCase()
        )
        if (oldIndex >= 0) {
          const updatedLineup = [...festival.lineup]
          updatedLineup[oldIndex] = result.name
          updatedMeta[festivalId] = { ...festival, lineup: updatedLineup }
        }
      }
      return { ...prev, festivalMeta: updatedMeta }
    })
  }, [userId, promptAuth])

  const batchEnrichArtists = useCallback((metadata: Record<string, any>) => {
    setState(prev => ({ ...prev, artistMeta: { ...prev.artistMeta, ...metadata } }))
  }, [])

  const importData = useCallback((data: any) => {
    console.warn('importData not yet implemented for DB mode')
  }, [])

  const addCustomFestival = useCallback(async (meta: any, lineup: any[] = []) => {
    if (!userId) { promptAuth(); return '' }
    if (!isAdmin) { return '' }
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
    await addAttendance(id)

    return id
  }, [userId, promptAuth])

  const clearFestivals = useCallback(async (type: string) => {
    setState(prev => {
      if (type === 'past') return { ...prev, attendedFestivals: [] }
      return { ...prev, upcomingFestivals: [] }
    })
    if (userId) {
      await clearUserFestivals(type as 'past' | 'upcoming')
    }
  }, [userId])

  const updateFestivalMeta = useCallback((id: string, meta: any) => {
    if (!userId || !isAdmin) return
    setState(prev => {
      const base: Partial<FestivalMeta> = prev.festivalMeta[id] ?? {}
      const venueObj = typeof meta.venue === 'object' ? meta.venue : null
      const location = meta.location ?? venueObj?.city ?? base.location
      return { ...prev, festivalMeta: { ...prev.festivalMeta, [id]: { ...base, ...meta, location } } }
    })
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
    isAdmin,
    toggleFestival, toggleSawArtist,
    setRating, setPerformanceRating, setFestivalRating, setNotes, setFestivalNotes,
    ...readers,
    importData, addCustomFestival, clearFestivals,
    updateFestivalMeta, batchEnrichArtists,
    splitB2bArtist, createB2bSet, unsplitB2bSet, rateB2bSet: rateB2bSetFn, loadB2bSets, renameArtist,
  }), [
    state, loaded, isAdmin,
    toggleFestival, toggleSawArtist,
    setRating, setPerformanceRating, setFestivalRating, setNotes, setFestivalNotes,
    readers,
    importData, addCustomFestival, clearFestivals,
    updateFestivalMeta, batchEnrichArtists,
    splitB2bArtist, createB2bSet, unsplitB2bSet, rateB2bSetFn, loadB2bSets, renameArtist,
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
