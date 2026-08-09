'use client'

import Link from 'next/link'

const MODAL_Z_INDEX = 1000
const MODAL_MAX_WIDTH = 480
const STAR_COUNT = 5

type RatedFestival = {
  id: string
  name: string
  date: string | null
  rating: number
}

export default function AvgVibeModal({ festivals, onClose }: { festivals: RatedFestival[]; onClose: () => void }) {
  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: MODAL_Z_INDEX,
        background: 'var(--overlay-scrim)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-end',
        justifyContent: 'center',
        padding: '0 0 env(safe-area-inset-bottom, 0)',
      }}
    >
      <div
        className="fade-in"
        style={{
          background: 'var(--bg-card)',
          width: '100%', maxWidth: MODAL_MAX_WIDTH,
          borderRadius: '20px 20px 0 0',
          border: '1px solid var(--border)',
          overflow: 'hidden',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem' }}>Your Ratings</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.1rem', cursor: 'pointer', padding: '4px 8px' }}>&times;</button>
        </div>

        <div style={{ padding: '12px 20px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {festivals.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>No rated festivals yet.</p>
          ) : (
            festivals.map(fest => (
              <Link
                key={fest.id}
                href={`/festival/${fest.id}`}
                onClick={onClose}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                  padding: '12px 14px', background: 'var(--bg-secondary)', borderRadius: 12,
                  border: '1px solid var(--border)', textDecoration: 'none', color: 'inherit',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.92rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{fest.name}</div>
                  {fest.date && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{fest.date}</div>}
                </div>
                <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                  {Array.from({ length: STAR_COUNT }, (_, i) => (
                    <span key={i} style={{ fontSize: '0.85rem', color: i + 1 <= fest.rating ? 'var(--star-filled)' : 'var(--border-strong)' }}>★</span>
                  ))}
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
