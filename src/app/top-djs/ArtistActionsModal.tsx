'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { parseLocalDate } from '@/lib/dates'

const MODAL_Z_INDEX = 1000
const MODAL_MAX_WIDTH = 400
const MODAL_BORDER_RADIUS = 20

/** Pop-up modal for DJ actions (See History / Go to Profile) */
export default function ArtistActionsModal({
  artist,
  onClose,
  performanceRatings,
}: {
  artist: any
  onClose: () => void
  performanceRatings: Record<string, number>
}) {
  const router = useRouter()
  const [showHistory, setShowHistory] = useState(false)

  if (!artist) return null

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }

  const navigateToProfile = () => {
    router.push(`/artist/${artist.id}/${encodeURIComponent(artist.name)}`)
  }

  return (
    <div
      className="modal-overlay"
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        zIndex: MODAL_Z_INDEX,
      }}
    >
      <div
        className="fade-in"
        style={{
          background: 'var(--bg-card)',
          width: '100%',
          maxWidth: MODAL_MAX_WIDTH,
          borderRadius: MODAL_BORDER_RADIUS,
          border: '1px solid var(--border)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-xl)',
        }}
      >
        {!showHistory ? (
          <MainOptionsView
            artist={artist}
            onShowHistory={() => setShowHistory(true)}
            onNavigateProfile={navigateToProfile}
            onClose={onClose}
          />
        ) : (
          <HistoryView
            artist={artist}
            performanceRatings={performanceRatings}
            onBack={() => setShowHistory(false)}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  )
}

function MainOptionsView({
  artist,
  onShowHistory,
  onNavigateProfile,
  onClose,
}: {
  artist: any
  onShowHistory: () => void
  onNavigateProfile: () => void
  onClose: () => void
}) {
  return (
    <div style={{ padding: 24 }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: '1.2rem', fontFamily: 'var(--font-display)', fontWeight: 800, marginBottom: 6 }}>
          {artist.name}
        </div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: artist.avgSetRating > 0 ? 8 : 0 }}>
          Seen {artist.count} {artist.count === 1 ? 'time' : 'times'}
        </div>
        {artist.avgSetRating > 0 && <InlineStarRating rating={artist.avgSetRating} />}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <button className="btn btn-primary" onClick={onShowHistory} style={{ width: '100%', padding: '14px' }}>
          Show Festival History
        </button>
        <button className="btn btn-secondary" onClick={onNavigateProfile} style={{ width: '100%', padding: '14px', border: '1px solid var(--border)' }}>
          Go to DJ Profile
        </button>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 8, cursor: 'pointer' }}
        >
          Close
        </button>
      </div>
    </div>
  )
}

function HistoryView({
  artist,
  performanceRatings,
  onBack,
  onClose,
}: {
  artist: any
  performanceRatings: Record<string, number>
  onBack: () => void
  onClose: () => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '80vh' }}>
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <button
          onClick={onBack}
          style={{ background: 'none', border: 'none', color: 'var(--accent)', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}
        >
          &larr; Back
        </button>
        <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Festival History</span>
        <div style={{ width: 40 }} />
      </div>

      <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
        {artist.festivals.map((fest: any, idx: number) => {
          const setRating = performanceRatings?.[`${fest.id}::${artist.id}`] ?? 0
          return (
            <div
              key={fest.id + idx}
              style={{
                padding: '12px 0',
                borderBottom: idx === artist.festivals.length - 1 ? 'none' : '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {fest.name}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {fest.date ? parseLocalDate(fest.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Date TBA'}
                </div>
              </div>
              {setRating > 0 && <InlineStarRating rating={setRating} size="sm" />}
            </div>
          )
        })}
      </div>

      <button className="btn btn-primary" onClick={onClose} style={{ borderRadius: 0, padding: 16 }}>
        Done
      </button>
    </div>
  )
}

const STAR_COUNT = 5
const STAR_COLOR_FILLED = '#fbbf24'
const STAR_COLOR_EMPTY = 'rgba(255,255,255,0.15)'

function InlineStarRating({ rating, size = 'md' }: { rating: number; size?: 'sm' | 'md' }) {
  const fontSize = size === 'sm' ? '0.72rem' : '1rem'
  const labelFontSize = size === 'sm' ? '0.72rem' : '0.8rem'
  const rounded = Math.round(rating)

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: size === 'md' ? 'center' : undefined, gap: size === 'sm' ? 2 : 4 }}>
      {Array.from({ length: STAR_COUNT }, (_, i) => (
        <span key={i} style={{ fontSize, color: i + 1 <= rounded ? STAR_COLOR_FILLED : STAR_COLOR_EMPTY }}>&#9733;</span>
      ))}
      <span style={{ fontSize: labelFontSize, color: 'var(--text-muted)', marginLeft: size === 'sm' ? 0 : 4 }}>
        {rating.toFixed(1)}{size === 'md' ? ' avg' : ''}
      </span>
    </div>
  )
}
