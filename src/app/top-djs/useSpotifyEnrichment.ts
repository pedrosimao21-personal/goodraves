'use client'

import { useState, useEffect } from 'react'
import { enrichArtistNamesBatch } from '@/db/actions/artists'

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
      const allResults: Record<string, any> = {}

      for (let i = 0; i < artistNames.length && !cancelled; i += BATCH_SIZE) {
        const batch = artistNames.slice(i, i + BATCH_SIZE)
        try {
          const results = await (enrichArtistNamesBatch(batch) as unknown as Promise<Record<string, any>>)
          Object.assign(allResults, results)
        } catch {
          // batch failed, continue
        }
      }

      if (cancelled) return
      setData(allResults)
      if (onEnrich) onEnrich(allResults)
    }

    fetchBatch()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artistNames.join(',')])

  return data
}
