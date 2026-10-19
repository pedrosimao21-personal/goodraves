'use client'

import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { getFriendArtistRatingsForFestival, type FriendArtistRating } from '@/db/actions/friends'
import { getFriendsFeed, type FeedItem, type FestivalFeedItem, type FollowFeedItem } from '@/db/actions/friends-feed'
import { formatDate, formatRelativeTime } from '@/lib/format-date'
import { isFestivalPast } from '@/lib/festival-date'

const STAR_COUNT = 5

/** "{user} rated / went to / is going to {festival}" — derived from data
 * already on the row, no separate action-type column needed. */
function getVerb(item: FestivalFeedItem): string {
  if (item.rating) return 'rated'
  return isFestivalPast(item.festivalDate) ? 'went to' : 'is going to'
}

function DjsSeenPill({ friendUserId, festivalId, seenCount }: { friendUserId: string; festivalId: string; seenCount: number }) {
  const [expanded, setExpanded] = useState(false)
  const [artists, setArtists] = useState<FriendArtistRating[] | null>(null)
  const [loading, setLoading] = useState(false)

  const handleToggle = async () => {
    const next = !expanded
    setExpanded(next)
    if (next && artists === null) {
      setLoading(true)
      try {
        setArtists(await getFriendArtistRatingsForFestival(friendUserId, festivalId))
      } finally {
        setLoading(false)
      }
    }
  }

  return (
    <div style={{ marginTop: 6 }}>
      <button
        onClick={handleToggle}
        className="btn btn-ghost btn-sm"
        style={{ padding: '3px 10px', fontSize: '0.78rem' }}
      >
        🎧 {seenCount} DJ{seenCount !== 1 ? 's' : ''} seen {expanded ? '▲' : '▼'}
      </button>
      {expanded && (
        <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {loading ? (
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Loading…</span>
          ) : (
            artists?.map((a, i) => (
              <span key={i} className="tag" style={{ fontSize: '0.78rem', textTransform: 'none' }}>
                {a.artistName}{a.rating ? ` ★${a.rating}` : ''}
              </span>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function FestivalFeedRow({ item }: { item: FestivalFeedItem }) {
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
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 2 }}>
          <span><strong style={{ color: 'var(--text-primary)' }}>{item.username}</strong> {getVerb(item)}</span>
          <span style={{ flexShrink: 0, fontSize: '0.78rem' }}>{formatRelativeTime(item.updatedAt)}</span>
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
        {item.seenCount > 0 && (
          <DjsSeenPill friendUserId={item.userId} festivalId={item.festivalId} seenCount={item.seenCount} />
        )}
      </div>
    </div>
  )
}

function FollowFeedRow({ item }: { item: FollowFeedItem }) {
  const artistHref = `/artist/${item.artistId}/${encodeURIComponent(item.artistName)}`
  return (
    <div style={{
      display: 'flex', gap: 12, padding: '14px 16px', background: 'var(--bg-card)',
      border: '1px solid var(--border)', borderRadius: 12, alignItems: 'center',
    }}>
      {item.artistImage ? (
        <Image src={item.artistImage} alt={item.artistName} width={48} height={48} sizes="48px" style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
      ) : (
        <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--gradient-card)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🎤</div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 2 }}>
          <span><strong style={{ color: 'var(--text-primary)' }}>{item.username}</strong> started following</span>
          <span style={{ flexShrink: 0, fontSize: '0.78rem' }}>{formatRelativeTime(item.updatedAt)}</span>
        </div>
        <Link href={artistHref} style={{ fontWeight: 600, color: 'inherit', textDecoration: 'none' }}>
          {item.artistName}
        </Link>
      </div>
    </div>
  )
}

function FeedRow({ item }: { item: FeedItem }) {
  if (item.kind === 'follow') return <FollowFeedRow item={item} />
  return <FestivalFeedRow item={item} />
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
    return <p style={{ color: 'var(--text-muted)' }}>Add a friend above to see their festival and follow activity here.</p>
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
    return <p style={{ color: 'var(--text-muted)' }}>No activity yet</p>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map((item, i) => (
        <FeedRow key={`${item.kind}-${item.userId}-${item.updatedAt}-${i}`} item={item} />
      ))}
      {cursor && (
        <button className="btn btn-ghost btn-sm" onClick={handleLoadMore} disabled={loadingMore} style={{ alignSelf: 'center', marginTop: 8 }}>
          {loadingMore ? 'Loading…' : 'Load more'}
        </button>
      )}
    </div>
  )
}
