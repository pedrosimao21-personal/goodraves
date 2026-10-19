'use client'

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useAuthPrompt } from './AuthPromptContext'
import { followArtist, followArtists, getFollowedArtistIds, unfollowArtist } from '@/db/actions/artist-follows'

// Kept out of UserDataContext on purpose: that provider is already past the
// file-size limit, and follows are read by few components (FollowButton,
// /following), so a separate context also keeps follow toggles from
// re-rendering every attendance/rating consumer.
type FollowsContextType = {
  loaded: boolean
  followedIds: ReadonlySet<string>
  // Bumps on every successful change, so pages showing follow-derived data
  // (e.g. /following) can refetch.
  version: number
  isFollowing: (artistId: string) => boolean
  toggleFollow: (artistId: string) => Promise<void>
  followMany: (artistIds: string[]) => Promise<void>
}

const FollowsContext = createContext<FollowsContextType | null>(null)
const NO_FOLLOWS: ReadonlySet<string> = new Set()

function withIds(ids: ReadonlySet<string>, add: string[], remove: string[]): Set<string> {
  const next = new Set(ids)
  for (const id of add) next.add(id)
  for (const id of remove) next.delete(id)
  return next
}

export function FollowsProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const userId = (session?.user as { id?: string } | undefined)?.id
  const { promptAuth } = useAuthPrompt()
  const [ownIds, setFollowedIds] = useState<ReadonlySet<string>>(NO_FOLLOWS)
  // Which user `ownIds` was fetched for. Derived state instead of resetting
  // in the effect: a logged-out (or switched) session reads as "no follows"
  // without a setState-in-effect cascade.
  const [fetchedFor, setFetchedFor] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  const followedIds = userId && fetchedFor === userId ? ownIds : NO_FOLLOWS
  const loaded = status !== 'loading' && (!userId || fetchedFor === userId)

  useEffect(() => {
    if (!userId) return
    getFollowedArtistIds()
      .then((ids) => setFollowedIds(new Set(ids)))
      .catch((err) => {
        // Render as "follows nothing" rather than a stuck loading state; the
        // next toggle re-syncs that artist with the server.
        console.error('[FollowsContext] Failed to load follows:', err)
        setFollowedIds(NO_FOLLOWS)
      })
      .finally(() => setFetchedFor(userId))
  }, [userId])

  const isFollowing = useCallback((artistId: string) => followedIds.has(artistId), [followedIds])

  const toggleFollow = useCallback(async (artistId: string) => {
    if (!userId) { promptAuth(); return }
    const wasFollowing = followedIds.has(artistId)
    setFollowedIds((prev) => (wasFollowing ? withIds(prev, [], [artistId]) : withIds(prev, [artistId], [])))
    try {
      if (wasFollowing) await unfollowArtist(artistId)
      else await followArtist(artistId)
      setVersion((v) => v + 1)
    } catch (err) {
      // The mutation didn't happen — undo the optimistic update.
      setFollowedIds((prev) => (wasFollowing ? withIds(prev, [artistId], []) : withIds(prev, [], [artistId])))
      throw err
    }
  }, [userId, followedIds, promptAuth])

  const followMany = useCallback(async (artistIds: string[]) => {
    if (!userId) { promptAuth(); return }
    const newIds = artistIds.filter((id) => !followedIds.has(id))
    if (newIds.length === 0) return
    setFollowedIds((prev) => withIds(prev, newIds, []))
    try {
      await followArtists(newIds)
      setVersion((v) => v + 1)
    } catch (err) {
      setFollowedIds((prev) => withIds(prev, [], newIds))
      throw err
    }
  }, [userId, followedIds, promptAuth])

  const value = useMemo(
    () => ({ loaded, followedIds, version, isFollowing, toggleFollow, followMany }),
    [loaded, followedIds, version, isFollowing, toggleFollow, followMany]
  )

  return <FollowsContext.Provider value={value}>{children}</FollowsContext.Provider>
}

export function useFollows(): FollowsContextType {
  const context = useContext(FollowsContext)
  if (!context) throw new Error('useFollows must be used inside FollowsProvider')
  return context
}
