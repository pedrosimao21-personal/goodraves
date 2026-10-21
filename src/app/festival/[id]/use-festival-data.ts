'use client'

import { useCallback, useEffect, useState } from 'react'
import { useUserData } from '@/context/UserDataContext'
import { getFestival, getTimetable, type TimetableData } from '@/db/actions/festivals'
import { getArtistsWithImages } from '@/db/actions/artist-images'
import { getFestivalPlaylist, type FestivalPlaylistData } from '@/db/actions/festival-playlist'
import { IMAGE_ENRICH_CHUNK_SIZE } from '@/lib/constants'
import { type FestivalEvent, transformDbFestival } from './festival-event'

const EMPTY_TIMETABLE: TimetableData = { days: [], stagesByDay: {} }

type InitialData = {
  initialFestival: any
  initialTimetable: TimetableData | null
  initialPlaylist: FestivalPlaylistData | null | undefined
}

/**
 * The festival, its timetable, lineup images and playlist. Uses the server
 * component's data when it has it. Each `initial*` prop is re-applied when it
 * changes, because Next reuses this component across /festival/[id]
 * navigations instead of remounting it.
 */
export function useFestivalData(id: string, { initialFestival, initialTimetable, initialPlaylist }: InitialData) {
  const { festivalMeta, loadB2bSets } = useUserData()
  const [event, setEvent] = useState<FestivalEvent | null>(() => initialFestival ? transformDbFestival(initialFestival) : null)
  const [loading, setLoading] = useState(!initialFestival)
  const [error, setError] = useState<Error | null>(null)
  const [spotifyData, setSpotifyData] = useState<Record<string, any>>({})
  const [playlist, setPlaylist] = useState<FestivalPlaylistData | null>(() => initialPlaylist ?? null)
  const [timetable, setTimetable] = useState<TimetableData>(() => initialTimetable ?? EMPTY_TIMETABLE)
  const isCustom = id.startsWith('custom-')

  useEffect(() => {
    if (initialFestival) {
      setEvent(transformDbFestival(initialFestival))
      setLoading(false)
      setError(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    getFestival(id)
      .then(dbFestival => {
        if (cancelled) return
        const meta = isCustom ? festivalMeta[id] : null
        if (dbFestival) {
          setEvent(transformDbFestival(dbFestival))
        } else if (meta) {
          const attractions = (meta.lineup || []).map((name: string) => ({ id: name, name }))
          setEvent({ ...meta, attractions })
        } else {
          setError(new Error('Event not found.'))
        }
        setLoading(false)
      })
      .catch(err => {
        if (cancelled) return
        setError(err instanceof Error ? err : new Error('Failed to load event'))
        setLoading(false)
      })

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, initialFestival])

  useEffect(() => {
    const needsEnrich: string[] = (event?.attractions ?? []).filter((a: any) => !a.image).map((a: any) => a.name)
    if (needsEnrich.length === 0) return
    let cancelled = false

    // Sequential chunks, so images fill in progressively. The per-name Spotify
    // search has to be serial (parallel searches get 429-blocked), so chunking
    // only changes when results surface, not the total work.
    ;(async () => {
      for (let i = 0; i < needsEnrich.length; i += IMAGE_ENRICH_CHUNK_SIZE) {
        if (cancelled) return
        try {
          const data = await getArtistsWithImages(needsEnrich.slice(i, i + IMAGE_ENRICH_CHUNK_SIZE))
          if (cancelled) return
          setSpotifyData((prev) => {
            const next = { ...prev }
            for (const [name, entry] of Object.entries(data)) {
              if (entry) next[name] = { id: entry.id, image: entry.imageUrl }
            }
            return next
          })
        } catch (err) {
          // Images are optional: the cards show a monogram for this chunk.
          console.error('[festival] Failed to enrich artist images:', err)
        }
      }
    })()

    return () => { cancelled = true }
  }, [event])

  useEffect(() => {
    if (!event) return
    if (initialPlaylist !== undefined) {
      setPlaylist(initialPlaylist)
      return
    }

    let cancelled = false
    const lineupNames = (event.attractions ?? []).map((a: { name: string }) => a.name).filter(Boolean)
    ;(getFestivalPlaylist(event.name, lineupNames) as unknown as Promise<FestivalPlaylistData | null>)
      .then(data => { if (!cancelled) setPlaylist(data) })
      // The playlist is an optional embed: clearing it hides the section
      // instead of failing the page.
      .catch(() => { if (!cancelled) setPlaylist(null) })

    return () => { cancelled = true }
  }, [event, initialPlaylist])

  const refreshTimetable = useCallback(() => {
    getTimetable(id).then(setTimetable).catch(() => { /* keep the timetable already on screen */ })
  }, [id])

  useEffect(() => {
    // B2B sets live in the shared UserDataContext; this page reads them through getB2bSets(id).
    loadB2bSets(id)
    if (initialTimetable) {
      setTimetable(initialTimetable)
      return
    }
    refreshTimetable()
  }, [id, loadB2bSets, initialTimetable, refreshTimetable])

  /** Re-reads the festival after an admin change (merge, re-import). */
  const reloadFestival = useCallback(async () => {
    const updated = await getFestival(id)
    if (updated) setEvent(transformDbFestival(updated))
  }, [id])

  return { event, loading, error, spotifyData, playlist, timetable, refreshTimetable, reloadFestival }
}
