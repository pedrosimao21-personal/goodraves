'use client'

import Image from 'next/image'
import { SpotifyIcon } from '@/components/icons'

const STAR_COUNT = 5
const STAR_COLOR_FILLED = '#fbbf24'
const STAR_COLOR_EMPTY = 'rgba(255,255,255,0.15)'
const MEDALS = ['\u{1F947}', '\u{1F948}', '\u{1F949}']

export function PageHeader({ availableYears, selectedYear, onYearChange }: {
  availableYears: string[]
  selectedYear: string
  onYearChange: (year: string) => void
}) {
  return (
    <div style={{ paddingTop: 8, marginBottom: 24 }}>
      <h1 className="section-title" style={{ fontSize: '2rem', fontFamily: 'var(--font-display)', fontWeight: 800, marginBottom: 6 }}>
        Most Watched DJs
      </h1>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
          Your ranking of artists by live performances seen
        </p>
        {availableYears.length > 0 && (
          <select
            value={selectedYear}
            onChange={e => onYearChange(e.target.value)}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '7px 12px',
              color: 'var(--text-primary)',
              fontSize: '0.88rem',
              fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            <option value="all">All years</option>
            {availableYears.map((y: string) => <option key={y} value={y}>{y}</option>)}
          </select>
        )}
      </div>
    </div>
  )
}

export function StatsBar({ ranking }: { ranking: any[] }) {
  return (
    <div className="stats-grid" style={{ marginBottom: 32 }}>
      <div className="stat-card">
        <div className="stat-label">Unique Artists</div>
        <div className="stat-value">{ranking.length}</div>
        <div className="stat-sub">different DJs seen</div>
      </div>
      <div className="stat-card">
        <div className="stat-label">Total Performances</div>
        <div className="stat-value">{ranking.reduce((s: number, a: any) => s + a.count, 0)}</div>
        <div className="stat-sub">live shows watched</div>
      </div>
      <div className="stat-card">
        <div className="stat-label">Top DJ</div>
        <div className="stat-value" style={{ fontSize: '1.3rem' }}>{ranking[0]?.name ?? '\u2014'}</div>
        <div className="stat-sub">{ranking[0]?.count ?? 0}&times; seen</div>
      </div>
    </div>
  )
}

export function ArtistRankingList({ ranking, spotifyData, artistMeta, onSelectArtist }: {
  ranking: any[]
  spotifyData: Record<string, any>
  artistMeta: Record<string, any>
  onSelectArtist: (artist: any) => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {ranking.map((artist: any, index: number) => {
        const sp = spotifyData[artist.name.toLowerCase()]
        const displayImage = artist.image || sp?.image || null
        return (
          <ArtistRow
            key={artist.id}
            artist={artist}
            index={index}
            displayImage={displayImage}
            hasSpotifyImage={!artist.image && !!sp?.image}
            onSelect={() => onSelectArtist(artist)}
          />
        )
      })}
    </div>
  )
}

function ArtistRow({ artist, index, displayImage, hasSpotifyImage, onSelect }: {
  artist: any
  index: number
  displayImage: string | null
  hasSpotifyImage: boolean
  onSelect: () => void
}) {
  const isTopThree = index < 3
  const isFirst = index === 0

  return (
    <div
      className="fade-in"
      style={{
        background: isTopThree ? 'var(--bg-card-hover)' : 'var(--bg-card)',
        border: `1px solid ${isFirst ? 'rgba(251, 191, 36, 0.3)' : 'var(--border)'}`,
        borderRadius: 14,
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        cursor: 'pointer',
        transition: 'border-color 250ms ease, transform 200ms ease',
        flexWrap: 'nowrap',
        overflow: 'hidden',
      }}
      onClick={onSelect}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hover)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = isFirst ? 'rgba(251, 191, 36, 0.3)' : 'var(--border)'; e.currentTarget.style.transform = 'translateY(0)' }}
    >
      <div style={{ width: 40, textAlign: 'center', flexShrink: 0 }}>
        {isTopThree ? (
          <span style={{ fontSize: '1.6rem' }}>{MEDALS[index]}</span>
        ) : (
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-muted)' }}>
            #{index + 1}
          </span>
        )}
      </div>

      <div style={{ position: 'relative', flexShrink: 0 }}>
        {displayImage ? (
          <Image src={displayImage} alt={artist.name} width={50} height={50} style={{ borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border)' }} />
        ) : (
          <div style={{ width: 50, height: 50, borderRadius: '50%', background: 'var(--gradient-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', border: '2px solid var(--border)' }}>&#127908;</div>
        )}
        {hasSpotifyImage && (
          <span className="spotify-badge" style={{ position: 'absolute', bottom: -2, right: -2, width: 18, height: 18 }}>
            <SpotifyIcon size={10} />
          </span>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem', marginBottom: 4, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
          {artist.name}
        </div>
        {artist.avgSetRating > 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
            {Array.from({ length: STAR_COUNT }, (_, i) => (
              <span key={i} style={{ fontSize: '0.75rem', color: i + 1 <= Math.round(artist.avgSetRating) ? STAR_COLOR_FILLED : STAR_COLOR_EMPTY }}>&#9733;</span>
            ))}
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: 2 }}>{artist.avgSetRating.toFixed(1)}</span>
          </div>
        ) : (
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>No rating yet</div>
        )}
      </div>

      <div style={{ textAlign: 'center', flexShrink: 0 }}>
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: '1.5rem',
          fontWeight: 800,
          background: 'var(--gradient-hero)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          lineHeight: 1,
        }}>
          {artist.count}&times;
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          seen
        </div>
      </div>
    </div>
  )
}
