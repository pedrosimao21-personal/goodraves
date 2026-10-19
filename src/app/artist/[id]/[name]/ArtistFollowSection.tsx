'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useFollows } from '@/context/FollowsContext'
import { getArtistFollowContext, type ArtistFollowContext } from '@/db/actions/artist-follow-context'
import { formatDateRange } from '@/lib/format-date'
import { formatGigSet, formatNameList } from '@/lib/following-display'

const COLLAPSED_FESTIVAL_COUNT = 5

function FollowerLine({ context }: { context: ArtistFollowContext }) {
  const parts: string[] = []
  if (context.followerCount > 0) {
    parts.push(`${context.followerCount} ${context.followerCount === 1 ? 'raver follows' : 'ravers follow'}`)
  }
  if (context.friendsFollowing.length > 0) {
    parts.push(`incl. ${formatNameList(context.friendsFollowing)}`)
  }
  if (parts.length === 0) return null
  return <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>👥 {parts.join(' ')}</span>
}

function UpcomingOnGoodraves({ context }: { context: ArtistFollowContext }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const festivals = context.upcomingFestivals
  if (festivals.length === 0) return null
  const visible = isExpanded ? festivals : festivals.slice(0, COLLAPSED_FESTIVAL_COUNT)

  return (
    <div style={{ marginTop: 20 }}>
      <h2 className="section-title" style={{ fontSize: '1.1rem', marginBottom: 10 }}>Upcoming on Goodraves</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {visible.map((festival) => {
          const isMultiDay = Boolean(festival.endDate && festival.endDate !== festival.date)
          const place = [festival.venue, festival.location].filter(Boolean).join(', ')
          return (
            <Link key={festival.festivalId} href={`/festival/${festival.festivalId}`} className="followed-artist-card" style={{ color: 'inherit', textDecoration: 'none', display: 'block' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{formatDateRange(festival.date, festival.endDate)}</div>
              <div style={{ fontWeight: 700 }}>{festival.name}</div>
              {place && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{place}</div>}
              {festival.sets.map((set, i) => (
                <div key={i} style={{ fontSize: '0.78rem', color: 'var(--accent-purple)', marginTop: 2 }}>{formatGigSet(set, isMultiDay)}</div>
              ))}
            </Link>
          )
        })}
      </div>
      {festivals.length > COLLAPSED_FESTIVAL_COUNT && (
        <button className="btn btn-ghost btn-sm" onClick={() => setIsExpanded(!isExpanded)} style={{ marginTop: 8 }}>
          {isExpanded ? 'Show fewer' : `Show all ${festivals.length}`}
        </button>
      )}
    </div>
  )
}

/**
 * Follower/friends line and this artist's upcoming festivals from our own
 * lineups (the Follow button itself sits next to the name in ArtistHeader).
 * Refetches when a follow changes, so the follower count stays in step with
 * the button.
 */
export default function ArtistFollowSection({ artistId }: { artistId: string }) {
  const { version } = useFollows()
  const [context, setContext] = useState<ArtistFollowContext | null>(null)

  useEffect(() => {
    let isCancelled = false
    getArtistFollowContext(artistId)
      .then((next) => { if (!isCancelled) setContext(next) })
      .catch((err) => {
        console.error('[ArtistFollowSection] Failed to load follow context:', err)
        if (!isCancelled) setContext(null)
      })
    return () => { isCancelled = true }
  }, [artistId, version])

  if (!context) return null
  return (
    <div style={{ marginTop: 16 }}>
      <FollowerLine context={context} />
      <UpcomingOnGoodraves context={context} />
    </div>
  )
}
