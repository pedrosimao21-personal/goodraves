'use client'

import { memo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
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
  const { getPerformanceRating, rateB2bSet, unsplitB2bSet, isAdmin } = useUserData()
  const firstMember = b2bSet.members[0]
  const currentRating = firstMember ? getPerformanceRating(eventId, firstMember.artistId) : 0
  const [isRatingVisible, setIsRatingVisible] = useState(false)
  const [hover, setHover] = useState(0)
  const [showUnsplitConfirm, setShowUnsplitConfirm] = useState(false)
  const hasRating = currentRating > 0

  const ariaDisplayName = b2bSet.members.map(m => m.artistName).join(' b2b ')

  const displayName = b2bSet.members.map((m, idx) => (
    <span key={m.artistId}>
      {idx > 0 && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> b2b </span>}
      <Link
        href={`/artist/${m.artistId}/${encodeURIComponent(m.artistName)}`}
        style={{ color: 'inherit', textDecoration: 'none' }}
        onMouseEnter={e => { e.currentTarget.style.textDecoration = 'underline' }}
        onMouseLeave={e => { e.currentTarget.style.textDecoration = 'none' }}
      >
        {m.artistName}
      </Link>
    </span>
  ))

  const handleSetRating = (star: number) => {
    const newRating = star === currentRating ? 0 : star
    rateB2bSet(b2bSet.id, newRating)
  }

  const handleUnsplit = async () => {
    await unsplitB2bSet(b2bSet.id, b2bSet.festivalId)
    setShowUnsplitConfirm(false)
  }

  return (
    <>
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
                  quality={85}
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
                aria-label={`Mark ${ariaDisplayName} as seen`}
              >
                Mark as seen
              </button>
            )}
          </div>
        )}

        {/* Unsplit button — admin only */}
        {isAdmin && (
          <button
            className="artist-card-options-btn"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowUnsplitConfirm(true) }}
            title="Unsplit B2B"
          >
            &#8943;
          </button>
        )}
      </div>

      {/* Unsplit confirmation overlay */}
      {showUnsplitConfirm && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setShowUnsplitConfirm(false) }}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            padding: '0 0 env(safe-area-inset-bottom, 0)',
          }}
        >
          <div
            className="fade-in"
            style={{
              background: 'var(--bg-card)',
              width: '100%', maxWidth: 480,
              borderRadius: '20px 20px 0 0',
              border: '1px solid var(--border)',
              overflow: 'hidden',
            }}
          >
            <div style={{
              padding: '18px 20px 14px',
              borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem' }}>
                Remove B2B
              </span>
              <button
                onClick={() => setShowUnsplitConfirm(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.1rem', cursor: 'pointer', padding: '4px 8px' }}
              >
                &times;
              </button>
            </div>
            <div style={{ padding: '20px' }}>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: '0 0 16px' }}>
                Remove the B2B grouping for <strong>{b2bSet.originalArtistName}</strong>? The artists will reappear individually in the lineup.
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setShowUnsplitConfirm(false)} className="btn btn-secondary" style={{ flex: 1 }}>
                  Cancel
                </button>
                <button onClick={handleUnsplit} className="btn btn-primary" style={{ flex: 2 }}>
                  Remove B2B
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
})

export default B2bSetCard

