'use client'

import { memo, useState } from 'react'
import Image from 'next/image'
import { useUserData } from '@/context/UserDataContext'
import type { B2bSetData } from '@/context/user-data-state'

const STARS = [1, 2, 3, 4, 5]

interface B2bSetCardProps {
  b2bSet: B2bSetData
  eventId: string
  spotifyData: Record<string, any>
  isPast: boolean
}

const B2bSetCard = memo(function B2bSetCard({ b2bSet, eventId, spotifyData, isPast }: B2bSetCardProps) {
  const { getPerformanceRating, rateB2bSet } = useUserData()
  const firstMember = b2bSet.members[0]
  const currentRating = firstMember ? getPerformanceRating(eventId, firstMember.artistId) : 0
  const [isRatingVisible, setIsRatingVisible] = useState(false)
  const [hover, setHover] = useState(0)
  const hasRating = currentRating > 0

  const displayName = b2bSet.members.map((m, idx) => (
    <span key={m.artistId}>
      {idx > 0 && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> b2b </span>}
      {m.artistName}
    </span>
  ))

  const handleSetRating = (star: number) => {
    const newRating = star === currentRating ? 0 : star
    rateB2bSet(b2bSet.id, newRating)
  }

  return (
    <div className="artist-card fade-in" style={{ position: 'relative' }}>
      {/* B2B badge — top left corner */}
      <span style={{
        position: 'absolute',
        top: 8,
        left: 8,
        zIndex: 2,
        fontSize: '0.7rem',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: 4,
        padding: '2px 7px',
        color: 'var(--text-muted)',
        fontWeight: 700,
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
        lineHeight: '1.6',
      }}>
        B2B
      </span>

      <div style={{ position: 'relative', zIndex: 1, display: 'contents' }}>
        {/* Overlapping avatars */}
        <div style={{ display: 'flex', position: 'relative', width: 80 + (b2bSet.members.slice(0, 3).length - 1) * 30, height: 80, flexShrink: 0 }}>
          {b2bSet.members.slice(0, 3).map((member, idx) => {
            const sp = spotifyData[member.artistName]
            const memberImage = sp?.image ?? null
            const overlapOffset = idx * 30
            return memberImage ? (
              <Image
                key={member.artistId}
                className="artist-avatar"
                src={memberImage}
                alt={member.artistName}
                width={80}
                height={80}
                quality={90}
                sizes="80px"
                style={{
                  objectFit: 'cover',
                  position: 'absolute',
                  left: overlapOffset,
                  top: 0,
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  border: '2px solid var(--bg-card)',
                  zIndex: b2bSet.members.length - idx,
                }}
              />
            ) : (
              <div
                key={member.artistId}
                style={{
                  position: 'absolute',
                  left: overlapOffset,
                  top: 0,
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  background: 'var(--bg-secondary)',
                  border: '2px solid var(--bg-card)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.2rem',
                  zIndex: b2bSet.members.length - idx,
                }}
              >
                🎤
              </div>
            )
          })}
        </div>

        <div className="artist-name">{displayName}</div>
      </div>

      {isPast && (
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {hasRating || isRatingVisible ? (
            <div className="star-rating" role="group" aria-label="B2B set rating">
              {STARS.map(star => (
                <span
                  key={star}
                  className={`star ${(hover || currentRating) >= star ? 'filled' : ''}`}
                  style={{ fontSize: '1.3rem' }}
                  onClick={() => handleSetRating(star)}
                  onMouseEnter={() => setHover(star)}
                  onMouseLeave={() => setHover(0)}
                  role="button"
                  aria-label={`Rate ${star} star${star !== 1 ? 's' : ''}`}
                >
                  ★
                </span>
              ))}
            </div>
          ) : (
            <button
              className="mark-seen-btn"
              onClick={() => setIsRatingVisible(true)}
              aria-label={`Mark ${displayName} as seen`}
            >
              Mark as seen
            </button>
          )}
        </div>
      )}
    </div>
  )
})

export default B2bSetCard
