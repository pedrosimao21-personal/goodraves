'use client'

import { useEffect, useState } from 'react'
import {
  getArtistData,
  getArtistDataSnapshot,
  getOrCreateArtistByName,
  clearArtistCache,
  type ArtistData,
} from '@/db/actions/artists'

const LOAD_TIMEOUT_MS = 15_000

type CreatedArtist = { id: string; name: string }

function replaceArtistUrl(artist: ArtistData) {
  window.history.replaceState(null, '', `/artist/${artist.id}/${encodeURIComponent(artist.name)}`)
}

/** Creates (or finds) the artist row by name and loads it, for URL ids that don't resolve. */
async function loadByName(artistName: string): Promise<ArtistData | null> {
  const created = await (getOrCreateArtistByName(artistName) as unknown as Promise<CreatedArtist>)
  return getArtistData(created.id) as unknown as Promise<ArtistData | null>
}

/**
 * The artist: the cached DB snapshot first (from the server, or fetched here),
 * then a refresh of stale Spotify / Last.fm / RA data. `initialArtist` is
 * re-applied when it changes, because Next reuses this component across
 * /artist/[id]/[name] navigations instead of remounting it.
 */
export function useArtistData(artistId: string, artistName: string, initialArtist: ArtistData | null) {
  const [artist, setArtist] = useState<ArtistData | null>(initialArtist)
  const [loading, setLoading] = useState(!initialArtist)
  const [refreshing, setRefreshing] = useState(Boolean(initialArtist))
  const [notFound, setNotFound] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const [reportSent, setReportSent] = useState(false)

  useEffect(() => {
    if (!artistId) return
    let cancelled = false
    setTimedOut(false)
    setReportSent(false)

    if (initialArtist) {
      setArtist(initialArtist)
      setLoading(false)
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    const timeout = setTimeout(() => {
      if (!cancelled) { setTimedOut(true); setLoading(false) }
    }, LOAD_TIMEOUT_MS)

    const finish = (fresh: ArtistData | null, hasSnapshot: boolean) => {
      clearTimeout(timeout)
      if (cancelled) return
      if (fresh) setArtist(fresh)
      else if (!hasSnapshot) setNotFound(true)
      setLoading(false)
      setRefreshing(false)
    }

    const fetchArtist = async () => {
      let snapshot = initialArtist
      try {
        if (!snapshot) {
          // Cached DB data paints within ~200ms for known artists, before the
          // slower refresh from the external APIs below.
          snapshot = await (getArtistDataSnapshot(artistId) as unknown as Promise<ArtistData | null>)
          if (cancelled) return
          if (snapshot) {
            setArtist(snapshot)
            setLoading(false)
            setRefreshing(true)
          }
        }

        let fresh = await (getArtistData(artistId) as unknown as Promise<ArtistData | null>)
        if (!fresh && !snapshot) {
          fresh = await loadByName(artistName)
          if (fresh) replaceArtistUrl(fresh)
        }
        finish(fresh, Boolean(snapshot))
      } catch {
        if (cancelled) return
        // The id lookup failed: fall back to creating or finding the artist by name.
        const byName = await loadByName(artistName).catch(() => null)
        if (byName) replaceArtistUrl(byName)
        finish(byName, false)
      }
    }

    fetchArtist()
    return () => { cancelled = true; clearTimeout(timeout) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artistId, initialArtist])

  /** Clears the cached enrichment and re-fetches it from the external APIs. */
  async function reportWrongData() {
    if (!artist?.id) return
    setRefreshing(true)
    try {
      await (clearArtistCache(artist.id) as unknown as Promise<void>)
      setReportSent(true)
      const fresh = await (getArtistData(artist.id) as unknown as Promise<ArtistData | null>)
      if (fresh) setArtist(fresh)
    } finally {
      setRefreshing(false)
    }
  }

  return { artist, loading, refreshing, notFound, timedOut, reportSent, reportWrongData }
}
