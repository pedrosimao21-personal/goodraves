'use client'

import React, { forwardRef } from 'react'

const CARD_STYLE: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.03)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 12,
  padding: '12px 14px',
  backdropFilter: 'blur(10px)',
}

const LABEL_STYLE: React.CSSProperties = {
  fontSize: '0.65rem',
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  color: '#888',
  marginBottom: 3,
}

const RaverPassport = forwardRef<HTMLDivElement, {
  events: any[]
  topArtists: string[]
  topGenre: string
  totalArtists: number
}>(({ events, topArtists, topGenre, totalArtists }, ref) => {

  // Calculate top city
  const cityCounts: Record<string, number> = {}
  events.forEach(e => {
    const city = e.venue?.city || 'Unknown'
    if (city !== 'Unknown') {
      cityCounts[city] = (cityCounts[city] || 0) + 1
    }
  })

  const topCity = Object.entries(cityCounts)
    .sort((a, b) => b[1] - a[1])
    .map(entry => entry[0])[0] ?? null

  const currentYear = new Date().getFullYear()

  return (
    <div
      ref={ref}
      style={{
        width: '360px',
        height: '640px',
        background: 'linear-gradient(135deg, #120e1f 0%, #000000 100%)',
        color: '#ffffff',
        padding: '28px 28px 24px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: 'var(--font-primary, sans-serif)',
      }}
    >
      {/* Decorative background elements */}
      <div style={{ position: 'absolute', top: -50, right: -50, width: 200, height: 200, background: 'radial-gradient(circle, rgba(139, 92, 246, 0.4) 0%, rgba(0,0,0,0) 70%)', filter: 'blur(30px)' }} />
      <div style={{ position: 'absolute', bottom: -50, left: -50, width: 250, height: 250, background: 'radial-gradient(circle, rgba(59, 130, 246, 0.3) 0%, rgba(0,0,0,0) 70%)', filter: 'blur(40px)' }} />

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 16, zIndex: 1 }}>
        <div style={{ fontSize: '0.7rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#c4b5fd', marginBottom: 3 }}>
          Goodraves Official
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 900, margin: 0, lineHeight: 1.1, textTransform: 'uppercase', letterSpacing: '-0.02em', color: '#ffffff' }}>
          Raver Passport
        </h1>
        <div style={{ fontSize: '0.85rem', color: '#fff', opacity: 0.7, marginTop: 3, fontStyle: 'italic' }}>
          {currentYear} Edition
        </div>
      </div>

      {/* Stats Body */}
      <div style={{ zIndex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* Lifetime Shows */}
        <div style={CARD_STYLE}>
          <div style={LABEL_STYLE}>Lifetime Shows</div>
          <div style={{ fontSize: '2rem', fontFamily: 'var(--font-display)', fontWeight: 800, lineHeight: 1 }}>{events.length}</div>
          <div style={{ fontSize: '0.78rem', color: '#aaa', marginTop: 3 }}>Across {totalArtists} unique artists</div>
        </div>

        {/* Top Genre & Home Base */}
        <div style={{ display: 'grid', gridTemplateColumns: topCity ? '1fr 1fr' : '1fr', gap: 10 }}>
          <div style={CARD_STYLE}>
            <div style={LABEL_STYLE}>Top Genre</div>
            <div style={{ fontSize: '1.1rem', fontFamily: 'var(--font-display)', fontWeight: 800, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', color: '#ec4899' }}>{topGenre || 'None'}</div>
          </div>
          {topCity && (
            <div style={CARD_STYLE}>
              <div style={LABEL_STYLE}>Home Base</div>
              <div style={{ fontSize: '0.95rem', fontFamily: 'var(--font-display)', fontWeight: 800, lineHeight: 1.2, wordBreak: 'break-word' }}>{topCity}</div>
            </div>
          )}
        </div>

        {/* Top DJs */}
        <div style={CARD_STYLE}>
          <div style={LABEL_STYLE}>Top DJs</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {topArtists.length > 0 ? topArtists.map((artist, idx) => (
              <div key={artist} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#8b5cf6', fontWeight: 800, fontSize: '0.95rem', minWidth: 16 }}>{idx + 1}</span>
                <span style={{ fontSize: '0.95rem', fontWeight: 600, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{artist}</span>
              </div>
            )) : <div style={{ fontSize: '0.85rem', color: '#ccc' }}>No artists found</div>}
          </div>
        </div>

      </div>

      {/* Spacer — pushes footer to bottom */}
      <div style={{ flex: 1 }} />

      {/* Footer / Barcode decoration */}
      <div style={{ zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div style={{ fontSize: '0.65rem', color: '#666', letterSpacing: '0.1em' }}>
          TRACKED VIA GOODRAVES
        </div>
        {/* Fake barcode - fixed pattern to avoid SSR/client mismatch */}
        <div style={{ display: 'flex', gap: 2, height: 20, opacity: 0.5 }}>
          {[2,4,2,2,4,2,4,4,2,4,2,2,4,2,4].map((w, i) => (
            <div key={i} style={{ width: w, height: '100%', background: '#fff' }} />
          ))}
        </div>
      </div>

    </div>
  )
})

RaverPassport.displayName = 'RaverPassport'

export default RaverPassport
