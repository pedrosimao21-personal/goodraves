'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useFollows } from '@/context/FollowsContext'
import FollowButton from '@/components/FollowButton'
import type { FollowSuggestion } from '@/db/actions/follow-suggestions'

const AVATAR_SIZE = 64

function describeSuggestion(suggestion: FollowSuggestion): string {
  const parts = [`Seen ${suggestion.timesSeen}×`]
  if (suggestion.bestRating) parts.push(`★${suggestion.bestRating}`)
  if (suggestion.upcomingCount > 0) parts.push(`${suggestion.upcomingCount} upcoming`)
  return parts.join(' · ')
}

/** Artists you've seen and liked but don't follow yet, with a one-tap "Follow all". */
export default function FollowSuggestions({ suggestions }: { suggestions: FollowSuggestion[] }) {
  const { isFollowing, followMany } = useFollows()
  const [isFollowingAll, setIsFollowingAll] = useState(false)
  const [hasError, setHasError] = useState(false)
  const remaining = suggestions.filter((s) => !isFollowing(s.artistId))

  if (remaining.length === 0) return null

  const handleFollowAll = async () => {
    setIsFollowingAll(true)
    setHasError(false)
    try {
      await followMany(remaining.map((s) => s.artistId))
    } catch (err) {
      console.error('[FollowSuggestions] Follow all failed:', err)
      setHasError(true)
    } finally {
      setIsFollowingAll(false)
    }
  }

  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 className="section-title" style={{ fontSize: '1.1rem', marginBottom: 2 }}>Suggested for you</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>DJs you rated highly or keep going back to.</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={handleFollowAll} disabled={isFollowingAll}>
          {isFollowingAll ? 'Following…' : `Follow all ${remaining.length}`}
        </button>
      </div>
      {hasError && <p style={{ color: 'var(--error-text)', fontSize: '0.85rem', marginBottom: 8 }}>Could not follow everyone, try again.</p>}
      <div className="follow-suggestions-row">
        {remaining.map((suggestion) => (
          <div key={suggestion.artistId} className="follow-suggestion-card">
            <Link href={`/artist/${suggestion.artistId}/${encodeURIComponent(suggestion.name)}`} style={{ color: 'inherit', textDecoration: 'none' }}>
              {suggestion.imageUrl ? (
                <Image src={suggestion.imageUrl} alt={suggestion.name} width={AVATAR_SIZE} height={AVATAR_SIZE} sizes={`${AVATAR_SIZE}px`} style={{ borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <div className="followed-artist-placeholder" style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }}>🎤</div>
              )}
              <div style={{ fontWeight: 700, fontSize: '0.85rem', marginTop: 6 }}>{suggestion.name}</div>
            </Link>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '2px 0 8px' }}>{describeSuggestion(suggestion)}</div>
            <FollowButton artistId={suggestion.artistId} artistName={suggestion.name} />
          </div>
        ))}
      </div>
    </div>
  )
}
