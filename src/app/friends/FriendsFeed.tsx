'use client'

import { useState, useCallback, useEffect } from 'react'
import { getFriendsFeed, type FeedItem } from '@/db/actions/friends-feed'
import { FeedRow } from './FeedRows'
import styles from './FriendsFeed.module.css'

const SKELETON_ROWS = [1, 2, 3]

/** Friends' festival and follow activity, paged by cursor. Board: Friends. */
export default function FriendsFeed({ hasFriends }: { hasFriends: boolean }) {
  const [items, setItems] = useState<FeedItem[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const loadPage = useCallback(async (after?: string) => {
    const { items: page, nextCursor } = await getFriendsFeed(after)
    setItems(prev => (after ? [...prev, ...page] : page))
    setCursor(nextCursor)
  }, [])

  useEffect(() => {
    if (!hasFriends) { setLoading(false); return }
    loadPage().finally(() => setLoading(false))
  }, [hasFriends, loadPage])

  const handleLoadMore = async () => {
    if (!cursor) return
    setLoadingMore(true)
    await loadPage(cursor)
    setLoadingMore(false)
  }

  return (
    <div>
      <div className={styles.header}>
        <h2 className={`display ${styles.title}`}>Activity</h2>
      </div>

      {!hasFriends && (
        <p className={styles.empty}>Add a friend to see the festivals they go to, what they rate and who they follow.</p>
      )}
      {hasFriends && loading && SKELETON_ROWS.map(i => <div key={i} className={`skeleton ${styles.skeletonRow}`} />)}
      {hasFriends && !loading && items.length === 0 && <p className={styles.empty}>No activity yet.</p>}

      {items.map((item, i) => (
        <FeedRow key={`${item.kind}-${item.userId}-${item.updatedAt}-${i}`} item={item} />
      ))}
      {cursor && (
        <button type="button" className={`btn ${styles.more}`} onClick={handleLoadMore} disabled={loadingMore}>
          {loadingMore ? 'Loading…' : 'Load more'}
        </button>
      )}
    </div>
  )
}
