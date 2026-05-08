'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { useUserData } from '@/context/UserDataContext'
import { getFestival } from '@/db/actions/festivals'
import { getArtistsWithImages } from '@/db/actions/artists'
import ArtistCard from '@/components/ArtistCard'

function BackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
    </svg>
  )
}

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

function formatDate(dateStr: string | undefined | null) {
  if (!dateStr) return 'Date TBA'
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

export default function FestivalDetail() {
  const params = useParams()
  const id = Array.isArray(params.id) ? params.id[0] : (params.id ?? '')
  const router = useRouter()
  const { isAttended, isUpcoming, toggleAttended, toggleUpcoming, getSeenCount, festivalMeta, artistMeta, setFestivalRating, getFestivalRating } = useUserData()

  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [spotifyData, setSpotifyData] = useState<Record<string, any>>({})

  const isRA = id.startsWith('ra-')
  const isCustom = id.startsWith('custom-')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    if (isCustom) {
      const meta = festivalMeta[id]
      if (meta) {
        const attractions = (meta.lineup || []).map(name => ({
          id: 'artist-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          name: name,
        }))
        setEvent({
          ...meta,
          attractions,
        })
        setLoading(false)
      } else {
        setError(new Error('Custom event not found.'))
        setLoading(false)
      }
    } else if (isRA) {
      getFestival(id).then(dbFestival => {
        if (cancelled) return
        if (dbFestival) {
          setEvent({
            id: dbFestival.id,
            name: dbFestival.name,
            date: dbFestival.date,
            venue: dbFestival.venue ? { name: dbFestival.venue, city: dbFestival.location ?? '' } : undefined,
            location: dbFestival.location,
            imageUrl: dbFestival.imageUrl,
            attractions: dbFestival.lineup ? dbFestival.lineup.map(name => ({
              id: name.toLowerCase().replace(/\s+/g, '-'),
              name: name
            })) : []
          })
          setLoading(false)
        } else {
          setError(new Error('Resident Advisor event not found.'))
          setLoading(false)
        }
      }).catch(err => {
        if (!cancelled) {
          setError(err)
          setLoading(false)
        }
      })
    } else {
      // Try to load from DB as a generic event
      getFestival(id).then(dbFestival => {
        if (cancelled) return
        if (dbFestival) {
          setEvent({
            id: dbFestival.id,
            name: dbFestival.name,
            date: dbFestival.date,
            venue: dbFestival.venue ? { name: dbFestival.venue, city: dbFestival.location ?? '' } : undefined,
            location: dbFestival.location,
            imageUrl: dbFestival.imageUrl,
            attractions: dbFestival.lineup ? dbFestival.lineup.map(name => ({
              id: name.toLowerCase().replace(/\s+/g, '-'),
              name: name
            })) : []
          })
        } else {
          setError(new Error('Event not found.'))
        }
      }).catch(err => {
        if (!cancelled) setError(err)
      }).finally(() => {
        if (!cancelled) setLoading(false)
      })
    }

    return () => { cancelled = true }
  }, [id])

  // Batch-fetch artist images: check DB first, fetch from Spotify only when missing or stale
  useEffect(() => {
    if (!event?.attractions?.length) return
    const needsEnrich = event.attractions.filter((a: any) => !a.image).map((a: any) => a.name)
    if (!needsEnrich.length) return
    let cancelled = false
    ;(getArtistsWithImages(needsEnrich) as unknown as Promise<Record<string, any>>)
      .then((data) => {
        if (cancelled) return
        // Normalize to the shape ArtistCard expects ({ image, genres })
        const normalized: Record<string, any> = {}
        for (const [name, entry] of Object.entries(data)) {
          if (entry) normalized[name] = { id: entry.id, image: entry.imageUrl, genres: entry.genres }
        }
        setSpotifyData(normalized)
      })
      .catch((err) => { console.error('[festival] getArtistsWithImages failed:', err) })
    return () => { cancelled = true }
  }, [event])

  const isFuture = event?.date && new Date(event.date + 'T00:00:00') > new Date()
  
  const attended = isAttended(id)
  const upcoming = isUpcoming(id)
  const seenCount = getSeenCount(id)

  const handleAction = () => {
    const payload = {
      name: event.name,
      date: event.date,
      venue: event.venue,
      image: event.image,
      genre: event.genre,
      source: event.source,
    }
    if (isFuture) {
      toggleUpcoming(id, payload)
    } else {
      toggleAttended(id, payload)
    }
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

  const externalUrl = event.url
  const externalLabel = 'View Event ↗'
  
  const isActive = isFuture ? upcoming : attended
  const actionLabelText = isFuture 
    ? (upcoming ? 'Going ✓' : 'Mark as Going')
    : (attended ? 'Attended ✓' : 'Mark as Attended')

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

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
            <h1 className="festival-hero-title" style={{ margin: 0 }}>{event.name}</h1>
          </div>

          <div className="festival-meta-row">
            <div className="festival-meta-chip">
              <CalIcon />
              {formatDate(event.date)}
            </div>
            {event.venue?.name && (
              <div className="festival-meta-chip">
                <PinIcon />
                {event.venue.name}
                {event.venue.city ? `, ${event.venue.city}` : ''}
                {event.venue.country ? `, ${event.venue.country}` : ''}
              </div>
            )}
            {event.genre && <span className="tag">{event.genre}</span>}
            {event.subGenre && event.subGenre !== event.genre && <span className="tag tag-orange">{event.subGenre}</span>}
            {event.ages && <span className="tag tag-purple">{event.ages}</span>}
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
                {isRA ? <ResidentAdvisorIcon size={14} /> : null}
                {isRA ? 'View on RA ↗' : externalLabel}
              </a>
            )}
          </div>

          {/* Festival Rating — only show when attended */}
          {attended && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                Vibe Rating
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[1, 2, 3, 4, 5].map(star => {
                  const current = getFestivalRating(id)
                  const filled = star <= current
                  return (
                    <button
                      key={star}
                      onClick={() => setFestivalRating(id, star === current ? 0 : star)}
                      title={`Rate ${star} star${star > 1 ? 's' : ''}`}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '1.6rem',
                        lineHeight: 1,
                        padding: '2px',
                        color: filled ? '#fbbf24' : 'rgba(255,255,255,0.2)',
                        transition: 'transform 120ms ease, color 120ms ease',
                        WebkitTapHighlightColor: 'transparent',
                      }}
                      onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.25)'}
                      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                    >
                      ★
                    </button>
                  )
                })}
                {getFestivalRating(id) > 0 && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', alignSelf: 'center', marginLeft: 4 }}>
                    {getFestivalRating(id)}/5
                  </span>
                )}
              </div>
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
              {event.attractions.map(artist => (
                <ArtistCard key={artist.id} artist={artist} eventId={id} spotifyData={spotifyData[artist.name]} />
              ))}
            </div>
          </>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">🎭</div>
            <h3>Lineup not available</h3>
            <p>The full lineup for this event hasn&apos;t been announced yet, or isn&apos;t available through the API.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function ResidentAdvisorIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2zm1 4h-4v12h2v-4h1l2 4h2.2l-2.2-4.4C14.1 13.2 15 12.2 15 11V9c0-1.7-1.3-3-3-3l1-2zm-1 2c.6 0 1 .4 1 1v2c0 .6-.4 1-1 1h-2V8h2z"/>
    </svg>
  )
}
