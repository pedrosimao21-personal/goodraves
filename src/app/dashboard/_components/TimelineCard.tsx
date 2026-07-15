'use client'

import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { formatDate } from '@/lib/format-date'

interface TimelineArtist {
  id: string
  name: string
  image: string | null
  rating: number
}

interface TimelineFestivalMeta {
  name?: string
  date?: string
  image?: string
  imageUrl?: string
  genres?: string[]
  venue?: { name?: string; city?: string } | string
}

interface TimelineCardProps {
  festivalId: string
  meta: TimelineFestivalMeta
  seenArtists: TimelineArtist[]
  isUpcoming: boolean
}

const ArtistChip = React.memo(({ artist }: { artist: TimelineArtist }) => (
  <Link
    href={`/artist/${artist.id}/${encodeURIComponent(artist.name)}`}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '6px 12px',
      borderRadius: 999,
      background: 'var(--bg-glass)',
      border: '1px solid var(--border)',
      fontSize: '0.82rem',
      fontWeight: 500,
      color: 'var(--text-primary)',
      textDecoration: 'none',
      transition: 'border-color 200ms ease',
      position: 'relative',
      zIndex: 1,
    }}
    onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border-hover)')}
    onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
  >
    {artist.image ? (
      <Image
        src={artist.image}
        alt=""
        width={22}
        height={22}
        sizes="22px"
        style={{ borderRadius: '50%', objectFit: 'cover' }}
      />
    ) : (
      <span>🎤</span>
    )}
    <span>{artist.name}</span>
    {artist.rating > 0 && (
      <span style={{ color: '#fbbf24', fontSize: '0.75rem' }}>{artist.rating}★</span>
    )}
  </Link>
))

ArtistChip.displayName = 'ArtistChip'

function buildVenueLabel(venue: TimelineFestivalMeta['venue']): string | null {
  if (!venue) return null
  if (typeof venue === 'string') return venue
  if (venue.name && venue.city) return `${venue.name}, ${venue.city}`
  if (venue.name) return venue.name
  if (venue.city) return venue.city
  return null
}

const TimelineCard = React.memo(({ festivalId, meta, seenArtists, isUpcoming }: TimelineCardProps) => {
  const festivalImage = meta.image || meta.imageUrl
  const venueLabel = buildVenueLabel(meta.venue)

  return (
    <div
      className="fade-in"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        overflow: 'hidden',
        transition: 'border-color 250ms ease',
        cursor: 'pointer',
        position: 'relative',
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border-hover)')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
    >
      <Link
        href={`/festival/${festivalId}`}
        aria-label={meta.name ?? festivalId}
        style={{ position: 'absolute', inset: 0, zIndex: 0 }}
      />

      <div style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        {festivalImage ? (
          <Image
            src={festivalImage}
            alt=""
            width={56}
            height={56}
            sizes="56px"
            style={{ borderRadius: 10, objectFit: 'cover', flexShrink: 0 }}
          />
        ) : (
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 10,
              background: 'var(--gradient-card)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem',
              flexShrink: 0,
            }}
          >
            🎪
          </div>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: '1.1rem',
              marginBottom: 4,
            }}
          >
            {meta.name ?? festivalId}
          </div>
          <div
            style={{
              fontSize: '0.82rem',
              color: 'var(--text-secondary)',
              display: 'flex',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            {meta.date && <span>📅 {formatDate(meta.date, 'timeline')}</span>}
            {venueLabel && <span>📍 {venueLabel}</span>}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {meta.genres?.map((genre) => (
            <span key={genre} className="tag">{genre}</span>
          ))}
          {isUpcoming && (
            <span
              className="tag"
              style={{ background: '#3b82f6', color: '#fff', borderColor: '#3b82f6' }}
            >
              Upcoming
            </span>
          )}
        </div>
      </div>

      {seenArtists.length > 0 && (
        <div style={{ padding: '0 24px 20px', borderTop: '1px solid var(--border)' }}>
          <div
            style={{
              fontSize: '0.78rem',
              color: 'var(--text-muted)',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              margin: '14px 0 10px',
            }}
          >
            Artists Seen ({seenArtists.length})
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {seenArtists.map(artist => (
              <ArtistChip key={artist.id} artist={artist} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
})

TimelineCard.displayName = 'TimelineCard'

export default TimelineCard
