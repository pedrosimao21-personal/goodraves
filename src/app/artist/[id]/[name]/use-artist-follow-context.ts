'use client'

import { useEffect, useState } from 'react'
import { useFollows } from '@/context/FollowsContext'
import { getArtistFollowContext, type ArtistFollowContext } from '@/db/actions/artist-follow-context'

const EMPTY_CONTEXT: ArtistFollowContext = { followerCount: 0, friendsFollowing: [], upcomingFestivals: [] }

/**
 * Follower count, friends following and this artist's upcoming festivals from
 * our own lineups. Refetches when a follow changes, so the count stays in
 * step with the Follow button. Null only while the first load is running.
 */
export function useArtistFollowContext(artistId: string | null): ArtistFollowContext | null {
  const { version } = useFollows()
  const [context, setContext] = useState<ArtistFollowContext | null>(null)

  useEffect(() => {
    if (!artistId) return
    let isCancelled = false
    getArtistFollowContext(artistId)
      .then((next) => { if (!isCancelled) setContext(next) })
      .catch((err) => {
        // The page renders without the follower stat and with RA shows only.
        console.error('[artist] Failed to load follow context:', err)
        if (!isCancelled) setContext(EMPTY_CONTEXT)
      })
    return () => { isCancelled = true }
  }, [artistId, version])

  return context
}
