'use client'

import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { getFriendsFeed, type FeedItem } from '@/db/actions/friends'
import { formatDate } from '@/lib/format-date'

const STAR_COUNT = 5

function FeedRow({ item }: { item: FeedItem }) {
  return (
    <div style={{
      display: 'flex', gap: 12, padding: '14px 16px', background: 'var(--bg-card)',
      border: '1px solid var(--border)', borderRadius: 12,
    }}>
      {item.festivalImage ? (
        <Image src={item.festivalImage} alt={item.festivalName} width={48} height={48} sizes="48px" style={{ borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
      ) : (
        <div style={{ width: 48, height: 48, borderRadius: 8, background: 'var(--gradient-card)', flexShrink: 0 }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 2 }}>
          <strong style={{ color: 'var(--text-primary)' }}>{item.username}</strong> marked
        </div>
        <Link href={`/festival/${item.festivalId}`} style={{ fontWeight: 600, color: 'inherit', textDecoration: 'none' }}>
          {item.festivalName}
        </Link>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>{formatDate(item.festivalDate)}</div>
        {item.rating && (
          <div style={{ marginTop: 4 }}>
            {Array.from({ length: STAR_COUNT }, (_, i) => (
              <span key={i} style={{ fontSize: '0.85rem', color: i < item.rating! ? 'var(--star-filled)' : 'var(--border-strong)' }}>★</span>
            ))}
          </div>
        )}
        {item.publicComment && (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '6px 0 0' }}>&ldquo;{item.publicComment}&rdquo;</p>
        )}
      </div>
    </div>
  )
}

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

  if (!hasFriends) {
    return <p style={{ color: 'var(--text-muted)' }}>Add a friend above to see their festival activity here.</p>
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ height: 76, borderRadius: 12, background: 'var(--bg-card)', animation: 'pulse 1.5s ease-in-out infinite' }} />
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return <p style={{ color: 'var(--text-muted)' }}>No activity yet — nothing to show once your friends mark festivals.</p>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map((item, i) => (
        <FeedRow key={`${item.userId}-${item.festivalId}-${i}`} item={item} />
      ))}
      {cursor && (
        <button className="btn btn-ghost btn-sm" onClick={handleLoadMore} disabled={loadingMore} style={{ alignSelf: 'center', marginTop: 8 }}>
          {loadingMore ? 'Loading…' : 'Load more'}
        </button>
      )}
    </div>
  )
}
