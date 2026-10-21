'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { getFriendsGoingForFestivals } from '@/db/actions/friends-going'

type FriendsByFestival = Record<string, string[]>

const NO_FRIENDS: FriendsByFestival = {}

/**
 * Friends going to each of the given festivals, loaded after the results
 * arrive. Skips the request for visitors who aren't logged in, and refetches
 * only when the set of ids changes.
 */
export function useFriendsGoing(festivalIds: string[]): FriendsByFestival {
  const { status } = useSession()
  const idsKey = useMemo(() => [...new Set(festivalIds)].sort().join('|'), [festivalIds])
  const [loaded, setLoaded] = useState<{ key: string; friends: FriendsByFestival }>({ key: '', friends: NO_FRIENDS })

  useEffect(() => {
    if (status !== 'authenticated' || !idsKey) return
    let isCancelled = false
    getFriendsGoingForFestivals(idsKey.split('|'))
      .then((friends) => { if (!isCancelled) setLoaded({ key: idsKey, friends }) })
      .catch((err) => {
        // Cards render without friends; the rest of Discover is unaffected.
        console.error('[discover] Failed to load friends going:', err)
        if (!isCancelled) setLoaded({ key: idsKey, friends: NO_FRIENDS })
      })
    return () => { isCancelled = true }
  }, [idsKey, status])

  // Results from another search show no stale friends while the new ones load.
  return loaded.key === idsKey ? loaded.friends : NO_FRIENDS
}
