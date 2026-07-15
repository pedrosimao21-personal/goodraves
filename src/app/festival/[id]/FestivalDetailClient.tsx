'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { useUserData } from '@/context/UserDataContext'
import { getFestival, reimportFestival, getTimetable, type TimetableStage } from '@/db/actions/festivals'
import { getArtistsWithImages } from '@/db/actions/artist-images'
import { IMAGE_ENRICH_CHUNK_SIZE } from '@/lib/constants'
import ArtistCard from '@/components/ArtistCard'
import B2bSetCard from '@/components/B2bSetCard'
import FestivalNotes from './FestivalNotes'
import TimetableView from './TimetableView'
import { BackIcon, SpotifyIcon } from '@/components/icons'
import { formatDate } from '@/lib/format-date'
import { parseLocalDate } from '@/lib/dates'
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
    interestedCount: dbFestival.interestedCount ?? 0,
    visitorsCount: dbFestival.visitorsCount ?? 0,
    attractions: dbFestival.lineup
      ? dbFestival.lineup.map((a: any) => ({ id: a.id, name: a.name }))
      : [],
  }
}

export default function FestivalDetail() {
  const params = useParams()
  const id = Array.isArray(params.id) ? params.id[0] : (params.id ?? '')
  const router = useRouter()
  const { isAttended, isUpcoming, toggleFestival, getSeenCount, festivalMeta, setFestivalRating, getFestivalRating, getFestivalNotes, setFestivalNotes, getB2bSets, loadB2bSets, isAdmin } = useUserData()

  const [event, setEvent] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [spotifyData, setSpotifyData] = useState<Record<string, any>>({})
  const [playlist, setPlaylist] = useState<FestivalPlaylistData | null>(null)
  const [showAdminMenu, setShowAdminMenu] = useState(false)
  const [showReimportConfirm, setShowReimportConfirm] = useState(false)
  const [isReimporting, setIsReimporting] = useState(false)
  const [timetableStages, setTimetableStages] = useState<TimetableStage[]>([])
  const [lineupView, setLineupView] = useState<'lineup' | 'timetable'>(
    typeof window !== 'undefined' && window.location.hash === '#timetable' ? 'timetable' : 'lineup'
  )

  const isCustom = id.startsWith('custom-')

  useEffect(() => {
    function onHashChange() {
      setLineupView(window.location.hash === '#timetable' ? 'timetable' : 'lineup')
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

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
        // Enrich in small SEQUENTIAL chunks so images fill in progressively
        // instead of appearing all-at-once after the whole lineup finishes. The
        // per-name Spotify search is necessarily serial (parallel search gets
        // 429-blocked), so chunking here only affects when results surface, not
        // total work — and awaiting each chunk keeps requests sequential.
        ;(async () => {
          for (let i = 0; i < needsEnrich.length; i += IMAGE_ENRICH_CHUNK_SIZE) {
            if (cancelled) return
            const chunk = needsEnrich.slice(i, i + IMAGE_ENRICH_CHUNK_SIZE)
            try {
              const data = await getArtistsWithImages(chunk)
              if (cancelled) return
              setSpotifyData((prev) => {
                const next = { ...prev }
                for (const [name, entry] of Object.entries(data)) {
                  if (entry) next[name] = { id: entry.id, image: entry.imageUrl }
                }
                return next
              })
            } catch (err) {
              console.error('[festival] Failed to enrich artist images:', err)
            }
          }
        })()
      }
    }

    // Always fetch playlist, even if no artists need enrichment.
    // Pass the first attraction as potential headliner for "This is {artist}" fallback.
    const headliner = event.attractions?.[0]?.name as string | undefined
    ;(getFestivalPlaylist(event.name, headliner) as unknown as Promise<FestivalPlaylistData | null>)
      .then(data => { if (!cancelled) setPlaylist(data) })
      .catch(() => {})

    return () => { cancelled = true }
  }, [event])

  useEffect(() => {
    loadB2bSets(id)
    getTimetable(id).then(stages => setTimetableStages(stages)).catch(() => {})
  }, [id, loadB2bSets])

  const isFuture = event?.date && parseLocalDate(event.date) > new Date()
  const attended = isAttended(id)
  const upcoming = isUpcoming(id)
  const seenCount = getSeenCount(id)

  function switchView(view: 'lineup' | 'timetable') {
    setLineupView(view)
    window.location.hash = view === 'timetable' ? 'timetable' : ''
  }

  const handleAction = () => {
    const payload = { name: event.name, date: event.date, venue: event.venue, image: event.image, source: event.source }
    toggleFestival(id, payload)
  }

  const handleReimport = async () => {
    setIsReimporting(true)
    try {
      await reimportFestival(id)
      // Re-fetch the festival so the updated lineup is reflected immediately
      const updated = await getFestival(id)
      if (updated) setEvent(transformDbFestival(updated))
      setShowReimportConfirm(false)
    } finally {
      setIsReimporting(false)
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

  const isRA = id.startsWith('ra-')
  const raEventId = isRA ? id.replace(/^ra-/, '') : null
  const externalUrl = raEventId ? `https://ra.co/events/${raEventId}` : null
  const isFF = id.startsWith('ff-')
  const ffSlug = isFF ? id.replace(/^ff-/, '') : null
  const ffExternalUrl = ffSlug ? `https://festivalfans.nl/event/${ffSlug}/` : null
  const isPF = id.startsWith('pf-')
  const pfPartyId = isPF ? id.replace(/^pf-/, '') : null
  const pfExternalUrl = pfPartyId ? `https://partyflock.nl/party/${pfPartyId}` : null
  const isActive = isFuture ? upcoming : attended
  const actionLabelText = isFuture
    ? (upcoming ? 'Going \u2713' : 'Mark as Going')
    : (attended ? 'Attended \u2713' : 'Mark as Attended')

  return (
    <div className="page">
      <div className="festival-hero">
        {event.image ? (
          <Image className="festival-hero-bg" src={event.image} alt="" width={1200} height={400} sizes="100vw" quality={85} priority style={{ objectFit: 'cover' }} aria-hidden />
        ) : (
          <div className="festival-hero-bg-fallback" />
        )}

        <div className="festival-hero-content">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 0 }}>
            <button className="festival-hero-back" onClick={() => router.back()} id="back-btn" style={{ marginBottom: 0 }}>
              <BackIcon /> Back to search
            </button>

            {isAdmin && !isCustom && (
              <button
                className="artist-card-options-btn"
                onClick={() => setShowAdminMenu(true)}
                title="Admin options"
                style={{
                  position: 'static',
                  opacity: 1,
                  pointerEvents: 'auto',
                  fontSize: '1rem',
                  padding: '4px 10px',
                  color: 'var(--text-secondary)',
                }}
              >
                &#8943;
              </button>
            )}
          </div>

          <h1 className="festival-hero-title">{event.name}</h1>

          <div className="festival-meta-row">
            <div className="festival-meta-chip"><CalIcon />{formatDate(event.date, 'long')}</div>
            {event.venue?.name && (
              <div className="festival-meta-chip">
                <PinIcon />
                {event.venue.name}{event.venue.city ? `, ${event.venue.city}` : ''}{event.venue.country ? `, ${event.venue.country}` : ''}
              </div>
            )}
            {event.interestedCount > 0 && (
              <div className="festival-meta-chip">🔥 {event.interestedCount.toLocaleString()} interested</div>
            )}
            {event.visitorsCount > 0 && (
              <div className="festival-meta-chip">👥 {event.visitorsCount.toLocaleString()} going</div>
            )}
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
                <Image src="/ra-logo.svg" alt="" width={20} height={10} unoptimized style={{ filter: 'invert(1)' }} /> View on Resident Advisor ↗
              </a>
            )}
            {ffExternalUrl && (
              <a href={ffExternalUrl} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm ra-link">
                <Image src="/festivalfans-icon.png" alt="" width={14} height={14} unoptimized /> View on FestivalFans ↗
              </a>
            )}
            {pfExternalUrl && (
              <a href={pfExternalUrl} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm ra-link">
                <Image src="/partyflock-icon.png" alt="" width={14} height={14} unoptimized /> View on Partyflock ↗
              </a>
            )}
          </div>

          {/* Admin options sheet */}
          {showAdminMenu && (
            <div
              onClick={(e) => { if (e.target === e.currentTarget) setShowAdminMenu(false) }}
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
                    Options
                  </span>
                  <button
                    onClick={() => setShowAdminMenu(false)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.1rem', cursor: 'pointer', padding: '4px 8px' }}
                  >
                    &times;
                  </button>
                </div>
                <button
                  onClick={() => { setShowAdminMenu(false); setShowReimportConfirm(true) }}
                  style={{
                    width: '100%', background: 'none', border: 'none',
                    color: 'var(--accent-red, #ef4444)',
                    fontSize: '0.95rem', fontFamily: 'var(--font-sans)',
                    padding: '16px 20px', textAlign: 'left', cursor: 'pointer',
                  }}
                >
                  Re-import Festival
                </button>
                <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)' }}>
                  <button onClick={() => setShowAdminMenu(false)} className="btn btn-secondary" style={{ width: '100%' }}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Re-import confirmation overlay — admin only */}
          {showReimportConfirm && (
            <div
              onClick={(e) => { if (e.target === e.currentTarget) setShowReimportConfirm(false) }}
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
                    Re-import Festival
                  </span>
                  <button
                    onClick={() => setShowReimportConfirm(false)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.1rem', cursor: 'pointer', padding: '4px 8px' }}
                  >
                    &times;
                  </button>
                </div>
                <div style={{ padding: '20px' }}>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: '0 0 16px' }}>
                    This will clear the entire lineup for <strong>{event.name}</strong>, including all B2B sets and any artist ratings logged for this festival, and re-fetch it from the source. This cannot be undone.
                  </p>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      onClick={() => setShowReimportConfirm(false)}
                      className="btn btn-secondary"
                      style={{ flex: 1 }}
                      disabled={isReimporting}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleReimport}
                      className="btn btn-primary"
                      style={{ flex: 2, background: 'var(--accent-red, #ef4444)', borderColor: 'var(--accent-red, #ef4444)' }}
                      disabled={isReimporting}
                    >
                      {isReimporting ? 'Re-importing…' : 'Re-import Festival'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

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
  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <h2 className="section-title" style={{ margin: 0 }}>
                  {lineupView === 'lineup' ? 'Lineup' : 'Timetable'}
                </h2>
                {lineupView === 'lineup' && (
                  <span className="section-count">{event.attractions.length} artist{event.attractions.length !== 1 ? 's' : ''}</span>
                )}
              </div>
              {timetableStages.length > 0 && (
                <div style={{ display: 'flex', gap: 4 }}>
                   <button
                    onClick={() => switchView('lineup')}
                    style={{
                      padding: '4px 12px',
                      borderRadius: 6,
                      border: '1px solid var(--border-subtle, rgba(255,255,255,0.12))',
                      background: lineupView === 'lineup' ? 'var(--accent, rgba(255,255,255,0.15))' : 'transparent',
                      color: lineupView === 'lineup' ? 'var(--text-primary, #fff)' : 'var(--text-muted)',
                      fontSize: '0.8rem',
                      fontWeight: lineupView === 'lineup' ? 600 : 400,
                      cursor: 'pointer',
                      transition: 'background 120ms, color 120ms',
                      WebkitTapHighlightColor: 'transparent',
                    }}
                  >
                    Lineup
                  </button>
                   <button
                    onClick={() => switchView('timetable')}
                    style={{
                      padding: '4px 12px',
                      borderRadius: 6,
                      border: '1px solid var(--border-subtle, rgba(255,255,255,0.12))',
                      background: lineupView === 'timetable' ? 'var(--accent, rgba(255,255,255,0.15))' : 'transparent',
                      color: lineupView === 'timetable' ? 'var(--text-primary, #fff)' : 'var(--text-muted)',
                      fontSize: '0.8rem',
                      fontWeight: lineupView === 'timetable' ? 600 : 400,
                      cursor: 'pointer',
                      transition: 'background 120ms, color 120ms',
                      WebkitTapHighlightColor: 'transparent',
                    }}
                  >
                    Timetable
                  </button>
                </div>
              )}
            </div>
            {lineupView === 'timetable' ? (
              <TimetableView stages={timetableStages} />
            ) : (
              <div className="grid-artists">
                {(() => {
                  const b2bSets = getB2bSets(id)
                  const b2bMemberIds = new Set(b2bSets.flatMap(s => s.members.map(m => m.artistId)))
                  const b2bOriginalNames = new Set(b2bSets.map(s => s.originalArtistName.toLowerCase()))
                  const soloArtists = event.attractions.filter(
                    (artist: any) => !b2bMemberIds.has(artist.id) && !b2bOriginalNames.has(artist.name.toLowerCase())
                  )
                  // Pre-compute available artists once (avoids O(n^2) per-item computation)
                  const allSoloForB2b = soloArtists.map((a: any) => ({ id: a.id, name: a.name }))
                  return (
                    <>
                      {b2bSets.map(b2bSet => (
                        <B2bSetCard key={b2bSet.id} b2bSet={b2bSet} eventId={id} spotifyData={spotifyData} isPast={!isFuture} />
                      ))}
                      {soloArtists.map((artist: any) => (
                            <ArtistCard
                              key={artist.id}
                              artist={artist}
                              eventId={id}
                              spotifyData={spotifyData[artist.name]}
                              isPast={!isFuture}
                              availableArtistsForB2b={allSoloForB2b}
                            />
                        ))
                      }
                    </>
                  )
                })()}
              </div>
            )}
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
