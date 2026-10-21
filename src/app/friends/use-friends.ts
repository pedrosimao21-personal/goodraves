'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  getFriendsData,
  sendFriendRequest,
  respondToFriendRequest,
  removeFriend,
  type FriendEntry,
} from '@/db/actions/friends'

/** Your friends, incoming and outgoing requests, and the actions that change them. */
export function useFriends(isAuthenticated: boolean) {
  const [friends, setFriends] = useState<FriendEntry[]>([])
  const [incoming, setIncoming] = useState<FriendEntry[]>([])
  const [outgoing, setOutgoing] = useState<FriendEntry[]>([])
  const [loaded, setLoaded] = useState(false)

  const refresh = useCallback(async () => {
    const data = await getFriendsData()
    setFriends(data.friends)
    setIncoming(data.incoming)
    setOutgoing(data.outgoing)
  }, [])

  useEffect(() => {
    if (!isAuthenticated) return
    refresh().finally(() => setLoaded(true))
  }, [isAuthenticated, refresh])

  const sendRequest = useCallback(async (username: string) => {
    await sendFriendRequest(username)
    await refresh()
  }, [refresh])

  const respond = useCallback(async (requesterId: string, accept: boolean) => {
    await respondToFriendRequest(requesterId, accept)
    await refresh()
  }, [refresh])

  const remove = useCallback(async (otherUserId: string) => {
    if (!confirm('Remove this friend?')) return
    await removeFriend(otherUserId)
    await refresh()
  }, [refresh])

  return { friends, incoming, outgoing, loaded, sendRequest, respond, remove }
}
