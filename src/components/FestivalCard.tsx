'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useUserData } from '../context/UserDataContext'
import { spotifySearchArtist } from '@/services/spotify/client'
import { getWikiImage } from '@/services/wikipedia/client'
import { formatDate } from '@/lib/format-date'

function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  )
}

function MapPinIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  )
}

const SOURCE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  ra: { label: 'RA', color: 'var(--text-muted)', bg: 'transparent' },
  festivalfans: { label: 'FestivalFans', color: 'var(--text-muted)', bg: 'transparent' },
  partyflock: { label: 'Partyflock', color: 'var(--text-muted)', bg: 'transparent' },
  custom: { label: 'Custom', color: 'var(--text-muted)', bg: 'var(--bg-tertiary, rgba(107,114,128,0.1))' },
  external: { label: 'External', color: 'var(--text-muted)', bg: 'var(--bg-tertiary, rgba(139,92,246,0.1))' },
}

function SourceBadge({ source, isFromDB }: { source?: string; isFromDB: boolean }) {
  const key = source ?? 'custom'
  const config = SOURCE_LABELS[key] ?? { label: key, color: 'var(--text-muted)', bg: 'var(--bg-tertiary, rgba(107,114,128,0.1))' }

  const badgeStyle = { background: '#000', borderColor: 'rgba(255,255,255,0.15)', borderRadius: '6px', padding: '4px 6px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '24px' }

  if (key === 'ra') {
    return (
      <span className="tag" style={badgeStyle}>
        <Image src="/ra-logo.svg" alt="Resident Advisor" width={20} height={10} unoptimized style={{ filter: 'invert(1)' }} />
      </span>
    )
  }

  if (key === 'festivalfans') {
    return (
      <span className="tag" style={badgeStyle}>
        <Image src="/festivalfans-icon.png" alt="FestivalFans" width={14} height={14} unoptimized />
      </span>
    )
  }

  if (key === 'partyflock') {
    return (
      <span className="tag" style={badgeStyle}>
        <Image src="/partyflock-icon.png" alt="Partyflock" width={14} height={14} unoptimized />
      </span>
    )
  }

  return (
    <span className="tag" style={{ background: config.bg, color: config.color, borderColor: 'var(--border, rgba(255,255,255,0.1))', fontSize: '0.65rem', padding: '1px 6px' }}>
      {config.label}
    </span>
  )
}

export default function FestivalCard({ event }: { event: any }) {
  const { isAttended, isUpcoming, toggleFestival, getSeenCount } = useUserData()
  
  const attended = isAttended(event.id)
  const upcoming = isUpcoming(event.id)
  const seenCount = getSeenCount(event.id)

  const artistCount = event.attractions?.length ?? 0
  
  // Check if event is in the future
  const isFuture = event.date && new Date(event.date + 'T00:00:00') > new Date()

  // Spotify image fallback for events without images
  const [fallbackImage, setFallbackImage] = useState<string | null>(null)
  
  useEffect(() => {
    if (event.image) return
    let cancelled = false
    
    const fetchWikiFallback = async () => {
      if (cancelled) return
      let img: string | null = null
      // Try venue name first
      if (event.venue?.name) {
        try { img = await getWikiImage(event.venue.name) } catch { /* wiki image unavailable for venue */ }
      }
      // If no venue image found, try city name
      if (!img && event.venue?.city) {
        try { img = await getWikiImage(event.venue.city) } catch { /* wiki image unavailable for city */ }
      }
      if (!cancelled && img) setFallbackImage(img)
    }

    if (artistCount > 0) {
      const mainArtist = event.attractions[0].name
      ;(spotifySearchArtist(mainArtist) as unknown as Promise<any>)
        .then((sp: any) => {
          if (!cancelled) {
            if (sp?.image) setFallbackImage(sp.image)
            else fetchWikiFallback()
          }
        })
        .catch(() => { if (!cancelled) fetchWikiFallback() })
    } else {
      fetchWikiFallback()
    }

    return () => { cancelled = true }
  }, [event.image, artistCount, event.attractions, event.venue?.city])

  const displayImage = event.image || fallbackImage

  const handleAction = (e: React.MouseEvent) => {
    e.stopPropagation()
    const payload = {
      name: event.name,
      date: event.date,
      endDate: event.endDate ?? null,
      venue: event.venue,
      location: event.location ?? null,
      latitude: event.latitude ?? null,
      longitude: event.longitude ?? null,
      image: displayImage,
      genre: event.genre,
      source: event.source,
    }
    toggleFestival(event.id, payload)
  }

  const festivalHref = `/festival/${event.id}`

  const isActive = isFuture ? upcoming : attended
  const actionLabelText = isFuture 
    ? (upcoming ? 'Going ✓' : 'Mark as Going')
    : (attended ? 'Attended ✓' : 'Mark as Attended')

  return (
    <Link href={festivalHref} className="festival-card fade-in">
      <div style={{ position: 'relative' }}>
        {displayImage ? (
          <Image className="festival-card-img" src={displayImage} alt={event.name} width={400} height={225} sizes="(max-width: 640px) 100vw, 400px" quality={85} style={{ objectFit: 'cover' }} />
        ) : (
          <div className="festival-card-img-placeholder">
            🎪
          </div>
        )}
        {(event._fromRA || event._fromFF || event._fromPF) && (
          <div style={{ position: 'absolute', top: 8, right: 8 }}>
            <SourceBadge source={event.source} isFromDB={false} />
          </div>
        )}
      </div>

      <div className="festival-card-body">
        <div className="festival-card-tags">
          {event.genre && <span className="tag">{event.genre}</span>}
          {event.subGenre && event.subGenre !== event.genre && (
            <span className="tag tag-orange">{event.subGenre}</span>
          )}
          {event.ages && <span className="tag tag-purple">{event.ages}</span>}
          {attended && <span className="tag tag-green">✓ Attended</span>}
          {upcoming && <span className="tag" style={{ background: '#3b82f6', color: '#fff', borderColor: '#3b82f6' }}>✓ Going</span>}
        </div>

        <h3 className="festival-card-title">{event.name}</h3>

        <div className="festival-card-meta">
          <div className="festival-card-meta-item">
            <CalendarIcon />
            {formatDate(event.date)}
          </div>
          {event.venue?.name && (
            <div className="festival-card-meta-item">
              <MapPinIcon />
              {event.venue.name}{event.venue.city ? `, ${event.venue.city}` : ''}
            </div>
          )}
        </div>

        {artistCount > 0 && (
          <div className="festival-card-artists">
            🎤 {artistCount} artist{artistCount !== 1 ? 's' : ''} in lineup
          </div>
        )}
      </div>

      <div className="festival-card-footer">
        <button 
          className={`attend-btn ${isActive ? 'attended' : ''}`} 
          onClick={handleAction} 
          id={`action-${event.id}`}
          style={isFuture && upcoming ? { background: '#3b82f6', borderColor: '#3b82f6', color: '#fff' } : {}}
        >
          <CheckIcon />
          <span className="attend-label">{actionLabelText}</span>
        </button>
        {attended && seenCount > 0 && (
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {seenCount} artist{seenCount !== 1 ? 's' : ''} seen
          </span>
        )}
      </div>
    </Link>
  )
}
