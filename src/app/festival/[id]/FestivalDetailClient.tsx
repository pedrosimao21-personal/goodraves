'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { useUserData } from '@/context/UserDataContext'
import { getFestival } from '@/db/actions/festivals'
import { getArtistsWithImages } from '@/db/actions/artist-images'
import ArtistCard from '@/components/ArtistCard'
import FestivalNotes from './FestivalNotes'
import { BackIcon, SpotifyIcon } from '@/components/icons'
import { formatDate } from '@/lib/format-date'
import { getFestivalPlaylist, type FestivalPlaylistData } from '@/db/actions/festival-playlist'

const STAR_COUNT = 5
const STAR_COLOR_FILLED = '#fbbf24'
const STAR_COLOR_EMPTY = 'rgba(255,255,255,0.2)'

function CalIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  )
}

function PinIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  )
}

/** Transform DB festival into the local event shape */
function transformDbFestival(dbFestival: any) {
  return {
    id: dbFestival.id,
    name: dbFestival.name,
    date: dbFestival.date,
    venue: dbFestival.venue ? { name: dbFestival.venue, city: dbFestival.location ?? '' } : undefined,
    location: dbFestival.location,
    imageUrl: dbFestival.imageUrl,
    attractions: dbFestival.lineup
      ? dbFestival.lineup.map((a: any) => ({ id: a.id, name: a.name }))
      : [],
  }
}

export default function FestivalDetail() {
  const params = useParams()
  const id = Array.isArray(params.id) ? params.id[0] : (params.id ?? '')
  const router = useRouter()
  const { isAttended, isUpcoming, toggleFestival, getSeenCount, festivalMeta, setFestivalRating, getFestivalRating, getFestivalNotes, setFestivalNotes } = useUserData()

  const [event, setEvent] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [spotifyData, setSpotifyData] = useState<Record<string, any>>({})
  const [playlist, setPlaylist] = useState<FestivalPlaylistData | null>(null)

  const isCustom = id.startsWith('custom-')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    getFestival(id)
      .then(dbFestival => {
        if (cancelled) return
        if (dbFestival) {
          setEvent(transformDbFestival(dbFestival))
        } else if (isCustom) {
          const meta = festivalMeta[id]
          if (meta) {
            const attractions = (meta.lineup || []).map((name: string) => ({ id: name, name }))
            setEvent({ ...meta, attractions })
          } else {
            setError(new Error('Event not found.'))
          }
        } else {
          setError(new Error('Event not found.'))
        }
        setLoading(false)
      })
      .catch(err => {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error('Failed to load event'))
          setLoading(false)
        }
      })

    return () => { cancelled = true }
  }, [id])

  useEffect(() => {
    if (!event) return
    let cancelled = false

    if (event.attractions && event.attractions.length > 0) {
      const needsEnrich = event.attractions.filter((a: any) => !a.image).map((a: any) => a.name)
      if (needsEnrich.length > 0) {
      ;(getArtistsWithImages(needsEnrich) as unknown as Promise<Record<string, any>>)
      .then((data) => {
        if (cancelled) return
        const normalized: Record<string, any> = {}
        for (const [name, entry] of Object.entries(data)) {
          if (entry) normalized[name] = { id: entry.id, image: entry.imageUrl }
        }
        setSpotifyData(normalized)
      })
      .catch((err) => {
        console.error('[festival] Failed to enrich artist images:', err)
      })
      }
    }

    // Always fetch playlist, even if no artists need enrichment
    ;(getFestivalPlaylist(event.name) as unknown as Promise<FestivalPlaylistData | null>)
      .then(data => { if (!cancelled) setPlaylist(data) })
      .catch(() => {})

    return () => { cancelled = true }
  }, [event])

  const isFuture = event?.date && new Date(event.date + 'T00:00:00') > new Date()
  const attended = isAttended(id)
  const upcoming = isUpcoming(id)
  const seenCount = getSeenCount(id)

  const handleAction = () => {
    const payload = { name: event.name, date: event.date, venue: event.venue, image: event.image, genre: event.genre, source: event.source }
    toggleFestival(id, payload)
  }

  if (loading) {
    return (
      <div className="page">
        <div className="container" style={{ paddingTop: 40 }}>
          <div className="skeleton" style={{ height: 48, width: '60%', marginBottom: 24 }} />
          <div className="skeleton" style={{ height: 24, width: '40%', marginBottom: 40 }} />
          <div className="grid-artists">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="skeleton skeleton-artist" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error || !event) return null

  const isRA = id.startsWith('ra-')
  const raEventId = isRA ? id.replace(/^ra-/, '') : null
  const externalUrl = raEventId ? `https://ra.co/events/${raEventId}` : null
  const isFF = id.startsWith('ff-')
  const ffSlug = isFF ? id.replace(/^ff-/, '') : null
  const ffExternalUrl = ffSlug ? `https://festivalfans.nl/event/${ffSlug}/` : null
  const isActive = isFuture ? upcoming : attended
  const actionLabelText = isFuture
    ? (upcoming ? 'Going \u2713' : 'Mark as Going')
    : (attended ? 'Attended \u2713' : 'Mark as Attended')

  return (
    <div className="page">
      <div className="festival-hero">
        {event.image ? (
          <Image className="festival-hero-bg" src={event.image} alt="" width={1200} height={400} style={{ objectFit: 'cover' }} aria-hidden />
        ) : (
          <div className="festival-hero-bg-fallback" />
        )}

        <div className="festival-hero-content">
          <button className="festival-hero-back" onClick={() => router.back()} id="back-btn">
            <BackIcon /> Back to search
          </button>

          <h1 className="festival-hero-title">{event.name}</h1>

          <div className="festival-meta-row">
            <div className="festival-meta-chip"><CalIcon />{formatDate(event.date, 'long')}</div>
            {event.venue?.name && (
              <div className="festival-meta-chip">
                <PinIcon />
                {event.venue.name}{event.venue.city ? `, ${event.venue.city}` : ''}{event.venue.country ? `, ${event.venue.country}` : ''}
              </div>
            )}
            {event.genre && <span className="tag">{event.genre}</span>}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <button
              id="detail-attend-btn"
              className={`attend-btn ${isActive ? 'attended' : ''}`}
              style={Object.assign({ fontSize: '0.95rem', padding: '10px 20px' }, isFuture && upcoming ? { background: '#3b82f6', borderColor: '#3b82f6', color: '#fff' } : {})}
              onClick={handleAction}
            >
              <CheckIcon />
              <span className="attend-label">{actionLabelText}</span>
            </button>

            {attended && seenCount > 0 && (
              <span style={{ fontSize: '0.85rem', color: 'var(--accent-green)' }}>
                You saw {seenCount} artist{seenCount !== 1 ? 's' : ''} here
              </span>
            )}

            {externalUrl && (
              <a href={externalUrl} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm ra-link">
                <Image src="/ra-logo.svg" alt="" width={20} height={10} style={{ filter: 'invert(1)' }} /> View on Resident Advisor ↗
              </a>
            )}
            {ffExternalUrl && (
              <a href={ffExternalUrl} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm ra-link">
                <Image src="/festivalfans-icon.png" alt="" width={14} height={14} /> View on FestivalFans ↗
              </a>
            )}
          </div>

          {attended && (
            <div style={{ marginTop: 16, display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <VibeRating eventId={id} rating={getFestivalRating(id)} onRate={setFestivalRating} />
              <FestivalNotes eventId={id} notes={getFestivalNotes(id)} onSave={setFestivalNotes} />
            </div>
          )}
        </div>
      </div>

      <div className="container">
        <div className="divider" />
        {event.attractions.length > 0 ? (
          <>
            <div className="section-header">
              <h2 className="section-title">Lineup</h2>
              <span className="section-count">{event.attractions.length} artist{event.attractions.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="grid-artists">
              {event.attractions.map((artist: any) => (
                <ArtistCard key={artist.id} artist={artist} eventId={id} spotifyData={spotifyData[artist.name]} isPast={!isFuture} />
              ))}
            </div>
          </>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">&#127917;</div>
            <h3>Lineup not available</h3>
            <p>The full lineup for this event hasn&apos;t been announced yet.</p>
          </div>
        )}

        {playlist && (
          <FestivalPlaylist playlist={playlist} festivalName={event.name} />
        )}
      </div>
    </div>
  )
}

function FestivalPlaylist({ playlist, festivalName }: { playlist: FestivalPlaylistData; festivalName: string }) {
  const spotifyFallbackUrl = `https://open.spotify.com/search/${encodeURIComponent(festivalName)}`
  const embedUrl = playlist.id ? `https://open.spotify.com/embed/playlist/${playlist.id}?utm_source=generator&theme=0` : null
  
  return (
    <div style={{ marginTop: 48, paddingBottom: 48 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <h2 className="section-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          Festival Playlist
        </h2>
        <a
          href={playlist.url ?? spotifyFallbackUrl}
          target="_blank"
          rel="noreferrer"
          className="btn spotify-link btn-sm"
          style={{ textDecoration: 'none' }}
        >
          <SpotifyIcon size={14} /> Open in Spotify
        </a>
      </div>
      
      {embedUrl ? (
        <iframe
          style={{ borderRadius: '12px' }}
          src={embedUrl}
          width="100%"
          height="352"
          frameBorder="0"
          allowFullScreen={false}
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
        />
      ) : (
        <p style={{ color: 'var(--text-muted)' }}>Playlist not available to embed.</p>
      )}
    </div>
  )
}

function VibeRating({ eventId, rating, onRate }: { eventId: string; rating: number; onRate: (id: string, r: number) => void }) {
  return (
    <div style={{ flexShrink: 0 }}>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
        Vibe Rating
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {Array.from({ length: STAR_COUNT }, (_, i) => {
          const star = i + 1
          const filled = star <= rating
          return (
            <button
              key={star}
              onClick={() => onRate(eventId, star === rating ? 0 : star)}
              title={`Rate ${star} star${star > 1 ? 's' : ''}`}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '1.6rem', lineHeight: 1, padding: '2px',
                color: filled ? STAR_COLOR_FILLED : STAR_COLOR_EMPTY,
                transition: 'transform 120ms ease, color 120ms ease',
                WebkitTapHighlightColor: 'transparent',
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.25)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              &#9733;
            </button>
          )
        })}
        {rating > 0 && (
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', alignSelf: 'center', marginLeft: 4 }}>
            {rating}/{STAR_COUNT}
          </span>
        )}
      </div>
    </div>
  )
}
