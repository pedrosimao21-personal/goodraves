'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  getFriendsData,
  sendFriendRequest,
  respondToFriendRequest,
  removeFriend,
  searchUsers,
  type FriendEntry,
  type UserSearchResult,
} from '@/db/actions/friends'
import { keepKeyboardOpenOnTap } from '@/lib/touch-tap'
import FriendsFeed from './FriendsFeed'

const SEARCH_DEBOUNCE_MS = 300

const FRIEND_STATUS_LABEL: Record<UserSearchResult['friendStatus'], string> = {
  friends: 'Already friends',
  outgoing: 'Request sent',
  incoming: 'Sent you a request',
  none: '',
}

export default function FriendsPage() {
  const { status } = useSession()
  const router = useRouter()
  const [friends, setFriends] = useState<FriendEntry[]>([])
  const [incoming, setIncoming] = useState<FriendEntry[]>([])
  const [outgoing, setOutgoing] = useState<FriendEntry[]>([])
  const [loaded, setLoaded] = useState(false)
  const [usernameInput, setUsernameInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([])
  const [showDropdown, setShowDropdown] = useState(false)

  const refresh = useCallback(async () => {
    const data = await getFriendsData()
    setFriends(data.friends)
    setIncoming(data.incoming)
    setOutgoing(data.outgoing)
  }, [])

  useEffect(() => {
    if (status !== 'authenticated') return
    refresh().finally(() => setLoaded(true))
  }, [status, refresh])

  // A redirect belongs in an effect, not the render body: next/navigation's
  // router touches `window` internally, so calling it directly during render
  // crashes SSR with "location is not defined" the moment `status` resolves
  // to 'unauthenticated' on the server pass.
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/friends')
    }
  }, [status, router])

  useEffect(() => {
    const query = usernameInput.trim()
    if (query.length < 2) {
      setSearchResults([])
      return
    }
    const timer = setTimeout(() => {
      searchUsers(query).then(setSearchResults).catch(() => setSearchResults([]))
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [usernameInput])

  if (status !== 'authenticated' || !loaded) {
    return (
      <div className="page">
        <div className="container" style={{ paddingTop: 32 }}>
          <div style={{ height: 40, width: 200, marginBottom: 24, borderRadius: 8, background: 'var(--bg-card)', animation: 'pulse 1.5s ease-in-out infinite' }} />
        </div>
      </div>
    )
  }

  const sendRequestTo = async (username: string) => {
    setIsSending(true)
    setError(null)
    try {
      await sendFriendRequest(username)
      setUsernameInput('')
      setSearchResults([])
      setShowDropdown(false)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send friend request')
    } finally {
      setIsSending(false)
    }
  }

  const handleSendRequest = (e: React.FormEvent) => {
    e.preventDefault()
    const username = usernameInput.trim()
    if (!username) return
    sendRequestTo(username)
  }

  const handleRespond = async (requesterId: string, accept: boolean) => {
    await respondToFriendRequest(requesterId, accept)
    await refresh()
  }

  const handleRemove = async (otherUserId: string) => {
    if (!confirm('Remove this friend?')) return
    await removeFriend(otherUserId)
    await refresh()
  }

  return (
    <div className="page">
      <div className="container" style={{ paddingTop: 32, paddingBottom: 48 }}>
        <h1 className="section-title" style={{ fontSize: '2.5rem', marginBottom: 8 }}>Friends</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: 32 }}>
          Beta. See what your friends are attending and rating.
        </p>

        <div style={{ position: 'relative', maxWidth: 420, marginBottom: 12 }}>
          <form onSubmit={handleSendRequest} style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={usernameInput}
              onChange={e => setUsernameInput(e.target.value)}
              onFocus={() => setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
              placeholder="Add a friend by username"
              autoComplete="off"
              style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'inherit', fontSize: '0.95rem' }}
            />
            <button className="btn btn-primary" onPointerDown={keepKeyboardOpenOnTap} disabled={isSending} type="submit">
              {isSending ? '...' : 'Add'}
            </button>
          </form>

          {showDropdown && searchResults.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, zIndex: 10,
              background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10,
              overflow: 'hidden', boxShadow: 'var(--shadow-dropdown)',
            }}>
              {searchResults.map(result => (
                <div
                  key={result.id}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--border)' }}
                >
                  <span>{result.username}</span>
                  {result.friendStatus === 'none' ? (
                    <button className="btn btn-primary btn-sm" onMouseDown={e => e.preventDefault()} onClick={() => sendRequestTo(result.username)} disabled={isSending}>
                      Add
                    </button>
                  ) : (
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{FRIEND_STATUS_LABEL[result.friendStatus]}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        {error && <p style={{ color: 'var(--error-text)', fontSize: '0.85rem', marginBottom: 24 }}>{error}</p>}

        {incoming.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <h2 className="section-title" style={{ fontSize: '1.1rem', marginBottom: 12 }}>Friend Requests</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {incoming.map(req => (
                <div key={req.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10 }}>
                  <span>{req.username}</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-primary btn-sm" onClick={() => handleRespond(req.id, true)}>Accept</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleRespond(req.id, false)}>Decline</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {outgoing.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <h2 className="section-title" style={{ fontSize: '1.1rem', marginBottom: 12 }}>Sent Requests</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {outgoing.map(req => (
                <div key={req.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10 }}>
                  <span>{req.username}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Pending</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginBottom: 32 }}>
          <h2 className="section-title" style={{ fontSize: '1.1rem', marginBottom: 12 }}>
            Your Friends {friends.length > 0 && `(${friends.length})`}
          </h2>
          {friends.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No friends yet. Add one by username above.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {friends.map(friend => (
                <div key={friend.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10 }}>
                  <span>{friend.username}</span>
                  <button className="btn btn-ghost btn-sm" onClick={() => handleRemove(friend.id)} style={{ color: 'var(--accent-red-bright)' }}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.1rem', marginBottom: 12 }}>Activity</h2>
          <FriendsFeed hasFriends={friends.length > 0} />
        </div>
      </div>
    </div>
  )
}
