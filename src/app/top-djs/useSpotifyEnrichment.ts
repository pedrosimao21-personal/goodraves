'use client'

import { useState, useEffect } from 'react'
import { spotifySearchArtist } from '@/services/spotify/client'
import { lastfmGetArtistInfo } from '@/services/lastfm/client'

const BATCH_SIZE = 10

/** Hook to batch-fetch Spotify + Last.fm data for a list of artist names */
export function useSpotifyEnrichment(
  artistNames: string[],
  onEnrich?: (results: Record<string, any>) => void
) {
  const [data, setData] = useState<Record<string, any>>({})

  useEffect(() => {
    if (artistNames.length === 0) return
    let cancelled = false

    const fetchBatch = async () => {
      const results: Record<string, any> = {}

      for (let i = 0; i < artistNames.length && !cancelled; i += BATCH_SIZE) {
        const batch = artistNames.slice(i, i + BATCH_SIZE)
        const promises = batch.map(async (name) => {
          let genres: string[] = []
          let image: string | null = null

          try {
            const sp = await spotifySearchArtist(name)
            if (sp) image = sp.image
          } catch {
            // Spotify lookup failed; will try Last.fm below
          }

          try {
            const info = await lastfmGetArtistInfo(name)
            if (info) {
              genres = info.tags || []
              if (!image) image = info.image
            }
          } catch {
            // Last.fm lookup failed; continue with partial data
          }

          return { name, genres, image }
        })

        const batchResults = await Promise.all(promises)
        batchResults.forEach((res) => {
          if (res) results[res.name] = res
        })
      }

      if (cancelled) return

      const normalizedResults: Record<string, any> = {}
      Object.keys(results).forEach(name => {
        normalizedResults[name.toLowerCase()] = results[name]
      })
      setData(normalizedResults)
      if (onEnrich) onEnrich(normalizedResults)
    }

    fetchBatch()
    return () => { cancelled = true }
  }, [artistNames.join(',')])

  return data
}
