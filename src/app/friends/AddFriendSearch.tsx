'use client'

import { useEffect, useState } from 'react'
import { searchUsers, type UserSearchResult } from '@/db/actions/friends'
import { keepKeyboardOpenOnTap } from '@/lib/touch-tap'
import styles from './Friends.module.css'

const SEARCH_DEBOUNCE_MS = 300
const MIN_QUERY_LENGTH = 2
const BLUR_CLOSE_DELAY_MS = 150

const FRIEND_STATUS_LABEL: Record<UserSearchResult['friendStatus'], string> = {
  friends: 'Already friends',
  outgoing: 'Request sent',
  incoming: 'Wants to be friends',
  none: '',
}

/** Username type-ahead; Enter or "Add" sends a request. Board: Friends. */
export default function AddFriendSearch({ onSendRequest }: { onSendRequest: (username: string) => Promise<void> }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<UserSearchResult[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setResults([])
      return
    }
    const timer = setTimeout(() => {
      searchUsers(trimmed).then(setResults).catch(() => setResults([]))
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query])

  const send = async (username: string) => {
    setIsSending(true)
    setError(null)
    try {
      await onSendRequest(username)
      setQuery('')
      setResults([])
      setIsOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send friend request')
    } finally {
      setIsSending(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const username = query.trim()
    if (username) send(username)
  }

  return (
    <div className={styles.addFriend}>
      <form onSubmit={handleSubmit}>
        <label className="form-label" htmlFor="add-friend-input">Add a friend by username</label>
        <div className={styles.addRow}>
          <input
            id="add-friend-input"
            className="form-input"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => setIsOpen(true)}
            onBlur={() => setTimeout(() => setIsOpen(false), BLUR_CLOSE_DELAY_MS)}
            placeholder="Username"
            autoComplete="off"
          />
          <button className="btn" onPointerDown={keepKeyboardOpenOnTap} disabled={isSending} type="submit">
            {isSending ? 'Adding…' : 'Add'}
          </button>
        </div>
      </form>

      {isOpen && results.length > 0 && (
        <div className={styles.results}>
          {results.map(result => (
            <div key={result.id} className={styles.result}>
              <span>{result.username}</span>
              {result.friendStatus === 'none' ? (
                <button type="button" className="btn btn-sm" onMouseDown={e => e.preventDefault()} onClick={() => send(result.username)} disabled={isSending}>
                  Add
                </button>
              ) : (
                <span className={`mono ${result.friendStatus === 'incoming' ? styles.goText : styles.muted}`}>
                  {FRIEND_STATUS_LABEL[result.friendStatus]}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
      {error && <p className="form-error">{error}</p>}
    </div>
  )
}
