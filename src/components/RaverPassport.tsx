'use client'

import React, { forwardRef } from 'react'

const RaverPassport = forwardRef<HTMLDivElement, {
  events: any[]
  topArtistName: string
  topGenre: string
  totalArtists: number
}>(({ events, topArtistName, topGenre, totalArtists }, ref) => {
  
  // Calculate top cities
  const cityCounts: Record<string, number> = {}
  events.forEach(e => {
    const city = e.venue?.city || 'Unknown'
    if (city !== 'Unknown') {
      cityCounts[city] = (cityCounts[city] || 0) + 1
    }
  })
  
  const topCities = Object.entries(cityCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(entry => entry[0])

  // Get current year
  const currentYear = new Date().getFullYear();

  return (
    <div
      ref={ref}
      style={{
        width: '360px',
        height: '640px',
        background: 'linear-gradient(135deg, #120e1f 0%, #000000 100%)',
        color: '#ffffff',
        padding: '32px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: 'var(--font-primary, sans-serif)'
      }}
    >
      {/* Decorative background elements */}
      <div style={{ position: 'absolute', top: -50, right: -50, width: 200, height: 200, background: 'radial-gradient(circle, rgba(139, 92, 246, 0.4) 0%, rgba(0,0,0,0) 70%)', filter: 'blur(30px)' }}></div>
      <div style={{ position: 'absolute', bottom: -50, left: -50, width: 250, height: 250, background: 'radial-gradient(circle, rgba(59, 130, 246, 0.3) 0%, rgba(0,0,0,0) 70%)', filter: 'blur(40px)' }}></div>
      
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 24, zIndex: 1, marginTop: 16 }}>
        <div style={{ fontSize: '0.8rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#c4b5fd', marginBottom: 4 }}>
          Goodraves Official
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.4rem', fontWeight: 900, margin: 0, textTransform: 'uppercase', letterSpacing: '-0.02em', background: 'var(--gradient-hero)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Raver Passport
        </h1>
        <div style={{ fontSize: '1rem', color: '#fff', opacity: 0.8, marginTop: 4, fontStyle: 'italic' }}>
          {currentYear} Edition
        </div>
      </div>

      {/* Stats Body */}
      <div style={{ zIndex: 1, display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24, marginTop: 0 }}>
        
        {/* Total Shows */}
        <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '16px', backdropFilter: 'blur(10px)' }}>
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#888', marginBottom: 4 }}>Lifetime Shows</div>
          <div style={{ fontSize: '2.5rem', fontFamily: 'var(--font-display)', fontWeight: 800, lineHeight: 1 }}>{events.length}</div>
          <div style={{ fontSize: '0.85rem', color: '#aaa', marginTop: 4 }}>Across {totalArtists} unique artists</div>
        </div>

        {/* Top Artist & Genre */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '16px', backdropFilter: 'blur(10px)' }}>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#888', marginBottom: 4 }}>#1 Artist</div>
            <div style={{ fontSize: '1.25rem', fontFamily: 'var(--font-display)', fontWeight: 800, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{topArtistName || 'None'}</div>
          </div>
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '16px', backdropFilter: 'blur(10px)' }}>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#888', marginBottom: 4 }}>Top Genre</div>
            <div style={{ fontSize: '1.25rem', fontFamily: 'var(--font-display)', fontWeight: 800, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', color: '#ec4899' }}>{topGenre || 'None'}</div>
          </div>
        </div>

        {/* Top Cities */}
        <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '16px', backdropFilter: 'blur(10px)' }}>
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#888', marginBottom: 8 }}>Top Hubs</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {topCities.length > 0 ? topCities.map((city, idx) => (
              <div key={city} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#8b5cf6', fontWeight: 800, fontSize: '1.1rem' }}>{idx + 1}</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>{city}</span>
              </div>
            )) : <div style={{ color: '#ccc' }}>No cities found</div>}
          </div>
        </div>

      </div>

      {/* Footer / Barcode decoration */}
      <div style={{ zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div style={{ fontSize: '0.7rem', color: '#666', letterSpacing: '0.1em' }}>
          TRACKED VIA GOODRAVES
        </div>
        {/* Fake barcode - fixed pattern to avoid SSR/client mismatch */}
        <div style={{ display: 'flex', gap: 2, height: 24, opacity: 0.5 }}>
          {[2,4,2,2,4,2,4,4,2,4,2,2,4,2,4].map((w, i) => (
            <div key={i} style={{ width: w, height: '100%', background: '#fff' }}></div>
          ))}
        </div>
      </div>

    </div>
  )
})

RaverPassport.displayName = 'RaverPassport'

export default RaverPassport
