'use client'

import { useMemo, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useUserData } from '@/context/UserDataContext'
import { spotifySearchArtist } from '@/db/actions/spotify'
import { lastfmGetArtistInfo } from '@/db/actions/lastfm'

function SpotifyIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#1DB954">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
    </svg>
  )
}

/** Hook to batch-fetch Spotify data for a list of artist names */
function useSpotifyEnrichment(artistNames: string[], onEnrich?: (results: Record<string, any>) => void) {
  const [data, setData] = useState<Record<string, any>>({})

  useEffect(() => {
    if (artistNames.length === 0) return
    let cancelled = false

    const fetchBatch = async () => {
      const results = {}
      
      for (let i = 0; i < artistNames.length && !cancelled; i += 10) {
        const batch = artistNames.slice(i, i + 10)
        const promises = batch.map(async (name) => {
          let genres = []
          let image = null
          
          // Try Spotify for image
          try {
            const sp = await spotifySearchArtist(name)
            if (sp) {
              image = sp.image
            }
          } catch (e) {
            console.warn(`Spotify search failed for ${name}`, e)
          }

          // Get genres from Last.fm
          try {
            const info = await lastfmGetArtistInfo(name)
            if (info) {
              genres = info.tags || []
              if (!image) image = info.image
            }
          } catch (e) {}
          
          return { name, genres, image }
        })
        
        const batchResults = await Promise.all(promises)
        batchResults.forEach((res) => {
          if (res) results[res.name] = res
        })
        
        // Remove delay for faster loads
      }

      if (!cancelled) {
        // Create a case-insensitive map for easier lookup
        const normalizedResults = {}
        Object.keys(results).forEach(name => {
          normalizedResults[name.toLowerCase()] = results[name]
        })
        setData(normalizedResults)
        if (onEnrich) onEnrich(normalizedResults)
      }
    }

    fetchBatch()
    return () => { cancelled = true }
  }, [artistNames.join(',')])

  return data
}

export default function TopDJs() {
  const router = useRouter()
  const { getArtistSeenCounts, artistMeta, performanceRatings, getFestivalMeta, batchEnrichArtists, loaded } = useUserData()
  const [selectedYear, setSelectedYear] = useState('all')
  const [artistToManage, setArtistToManage] = useState(null)

  // Build ranked list of artists by # of times seen, filtered by year
  const { ranking, availableYears } = useMemo(() => {
    const counts = getArtistSeenCounts()
    const years = new Set()

    const list = Object.entries(counts)
      .map(([artistId, { count, events }]: [string, any]) => {
        const meta = artistMeta[artistId]
        // Get festival info for each event
        const festivals = events.map(eid => {
          const fm = getFestivalMeta(eid)
          return { id: eid, name: fm?.name ?? eid, date: fm?.date ?? null }
        })

        // Track available years
        festivals.forEach(f => { if (f.date) years.add(f.date.substring(0, 4)) })

        // Filter by selected year
        const filtered = selectedYear === 'all'
          ? festivals
          : festivals.filter(f => f.date?.startsWith(selectedYear))

        if (filtered.length === 0) return null

        // Average set rating across all seen festivals
        const ratings = filtered.map(f => performanceRatings[`${f.id}::${artistId}`]).filter(r => r > 0)
        const avgSetRating = ratings.length > 0
          ? ratings.reduce((a, b) => a + b, 0) / ratings.length
          : 0

        return {
          id: artistId,
          name: meta?.name ?? artistId,
          image: meta?.image ?? null,
          count: filtered.length,
          avgSetRating,
          festivals: filtered.sort((a, b) => (a.date || '').localeCompare(b.date || '')),
        }
      })
      .filter(Boolean)
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count
        if (b.avgSetRating !== a.avgSetRating) return b.avgSetRating - a.avgSetRating
        return a.name.localeCompare(b.name)
      })

    return {
      ranking: list,
      availableYears: [...years].sort((a: any, b: any) => b.localeCompare(a)),
    }
  }, [getArtistSeenCounts, artistMeta, performanceRatings, getFestivalMeta, selectedYear])

  // Fetch Spotify data for ranked artists (up to 15) — skip already enriched
  const artistNames = useMemo(() => {
    return ranking
      .slice(0, 15)
      .filter(a => {
        const meta = artistMeta[a.id]
        return !meta?.genres || meta.genres.length === 0 || !meta?.image
      })
      .map(a => a.name)
  }, [ranking, artistMeta])
  
  const spotifyData = useSpotifyEnrichment(artistNames, (results) => {
    // Save enriched data back to global artistMeta
    const metaUpdates = {}
    ranking.slice(0, 15).forEach(artist => {
      const enriched = results[artist.name.toLowerCase()]
      if (enriched) {
        const hasNewGenres = enriched.genres && enriched.genres.length > 0
        const hasExistingGenres = (artistMeta[artist.id]?.genres ?? []).length > 0
        
        if (hasNewGenres || !hasExistingGenres) {
          metaUpdates[artist.id] = {
            name: enriched.name || artist.name,
            image: enriched.image || artist.image,
            genres: hasNewGenres ? enriched.genres : (artistMeta[artist.id]?.genres || []),
          }
        }
      }
    })
    if (Object.keys(metaUpdates).length > 0) {
      batchEnrichArtists(metaUpdates)
    }
  })

  const totalSeen = ranking.reduce((sum, a) => sum + a.count, 0)

  // Medal colors for top 3
  const medals = ['🥇', '🥈', '🥉']

  if (!loaded) {
    return (
      <div className="page">
        <div className="container" style={{ paddingTop: 32 }}>
          <div style={{ height: 40, width: 200, marginBottom: 24, borderRadius: 8, background: 'var(--bg-card)', animation: 'pulse 1.5s ease-in-out infinite' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} style={{ height: 82, borderRadius: 14, background: 'var(--bg-card)', animation: 'pulse 1.5s ease-in-out infinite', animationDelay: `${i * 0.1}s` }} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="container">
        <div style={{ paddingTop: 8, marginBottom: 24 }}>
          <h1 className="section-title" style={{ fontSize: '2rem', fontFamily: 'var(--font-display)', fontWeight: 800, marginBottom: 6 }}>
            Most Watched DJs
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
              Your ranking of artists by live performances seen
            </p>
            {/* Year filter */}
            {availableYears.length > 0 && (
              <select
                value={selectedYear}
                onChange={e => setSelectedYear(e.target.value)}
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

        {/* Quick stats bar */}
        {ranking.length > 0 && (
          <div className="stats-grid" style={{ marginBottom: 32 }}>
            <div className="stat-card">
              <div className="stat-label">Unique Artists</div>
              <div className="stat-value">{ranking.length}</div>
              <div className="stat-sub">different DJs seen</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total Performances</div>
              <div className="stat-value">{ranking.reduce((s,a)=>s+a.count,0)}</div>
              <div className="stat-sub">live shows watched</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Top DJ</div>
              <div className="stat-value" style={{ fontSize: '1.3rem' }}>{ranking[0]?.name ?? '—'}</div>
              <div className="stat-sub">{ranking[0]?.count ?? 0}× seen</div>
            </div>
          </div>
        )}

        {ranking.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🎤</div>
            <h3>No artists tracked yet</h3>
            <p>Go to a festival page and mark artists you&apos;ve seen to start building your ranking.</p>
            <button className="btn btn-primary" onClick={() => router.push('/')} id="go-discover-djs">
              Discover Festivals
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {ranking.map((artist, index) => {
              const sp = spotifyData[artist.name.toLowerCase()]
              const displayImage = artist.image || sp?.image || null
              return (
                <div
                  key={artist.id}
                  className="fade-in"
                  style={{
                    background: index < 3 ? 'var(--bg-card-hover)' : 'var(--bg-card)',
                    border: `1px solid ${index === 0 ? 'rgba(251, 191, 36, 0.3)' : 'var(--border)'}`,
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
                  onClick={() => setArtistToManage(artist)}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hover)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = index === 0 ? 'rgba(251, 191, 36, 0.3)' : 'var(--border)'; e.currentTarget.style.transform = 'translateY(0)' }}
                >
                  {/* Rank number */}
                  <div style={{ width: 40, textAlign: 'center', flexShrink: 0 }}>
                    {index < 3 ? (
                      <span style={{ fontSize: '1.6rem' }}>{medals[index]}</span>
                    ) : (
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-muted)' }}>
                        #{index + 1}
                      </span>
                    )}
                  </div>

                  {/* Avatar */}
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    {displayImage ? (
                      <Image
                        src={displayImage}
                        alt={artist.name}
                        width={50}
                        height={50}
                        style={{ borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border)' }}
                      />
                    ) : (
                      <div style={{ width: 50, height: 50, borderRadius: '50%', background: 'var(--gradient-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', border: '2px solid var(--border)' }}>🎤</div>
                    )}
                    {!artist.image && sp?.image && (
                      <span className="spotify-badge" style={{ position: 'absolute', bottom: -2, right: -2, width: 18, height: 18 }}>
                        <SpotifyIcon size={10} />
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem', marginBottom: 4, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                      {artist.name}
                    </div>
                    {/* Average set rating instead of genre tags */}
                    {artist.avgSetRating > 0 ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                        {[1,2,3,4,5].map(s => (
                          <span key={s} style={{ fontSize: '0.75rem', color: s <= Math.round(artist.avgSetRating) ? '#fbbf24' : 'rgba(255,255,255,0.15)' }}>★</span>
                        ))}
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: 2 }}>{artist.avgSetRating.toFixed(1)}</span>
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>No rating yet</div>
                    )}
                  </div>

                  {/* Count badge */}
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
                      {artist.count}×
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      seen
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        {ranking.length > 0 && (
          <div style={{ marginTop: 24, padding: '0 4px', fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            Click an artist to see history or go to profile
          </div>
        )}

        <ArtistActionsModal 
          artist={artistToManage} 
          onClose={() => setArtistToManage(null)} 
          performanceRatings={performanceRatings}
        />
      </div>
    </div>
  )
}

/** Pop-up modal for DJ actions (See History / Go to Profile) */
function ArtistActionsModal({ artist, onClose, performanceRatings }: { artist: any; onClose: () => void; performanceRatings: Record<string, number> }) {
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
        zIndex: 1000,
      }}
    >
      <div 
        className="fade-in"
        style={{
          background: 'var(--bg-card)',
          width: '100%',
          maxWidth: 400,
          borderRadius: 20,
          border: '1px solid var(--border)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-xl)',
        }}
      >
        {!showHistory ? (
          /* MAIN OPTIONS VIEW */
          <div style={{ padding: 24 }}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: '1.2rem', fontFamily: 'var(--font-display)', fontWeight: 800, marginBottom: 6 }}>
                {artist.name}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: artist.avgSetRating > 0 ? 8 : 0 }}>
                Seen {artist.count} {artist.count === 1 ? 'time' : 'times'}
              </div>
              {/* Avg rating in main view */}
              {artist.avgSetRating > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  {[1,2,3,4,5].map(s => (
                    <span key={s} style={{ fontSize: '1rem', color: s <= Math.round(artist.avgSetRating) ? '#fbbf24' : 'rgba(255,255,255,0.15)' }}>★</span>
                  ))}
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: 4 }}>{artist.avgSetRating.toFixed(1)} avg</span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button 
                className="btn btn-primary" 
                onClick={() => setShowHistory(true)}
                style={{ width: '100%', padding: '14px' }}
              >
                📜 Show Festival History
              </button>
              <button 
                className="btn btn-secondary" 
                onClick={navigateToProfile}
                style={{ width: '100%', padding: '14px', border: '1px solid var(--border)' }}
              >
                👤 Go to DJ Profile
              </button>
              <button 
                onClick={onClose}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  color: 'var(--text-muted)', 
                  fontSize: '0.85rem', 
                  marginTop: 8, 
                  cursor: 'pointer' 
                }}
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          /* HISTORY VIEW */
          <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '80vh' }}>
            <div style={{ 
              padding: '16px 20px', 
              borderBottom: '1px solid var(--border)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between' 
            }}>
              <button 
                onClick={() => setShowHistory(false)} 
                style={{ background: 'none', border: 'none', color: 'var(--accent)', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}
              >
                ← Back
              </button>
              <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Festival History</span>
              <div style={{ width: 40 }} /> {/* Spacer */}
            </div>

            <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
              {artist.festivals.map((fest, idx) => {
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
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fest.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {fest.date ? new Date(fest.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Date TBA'}
                      </div>
                    </div>
                    {/* Per-set rating — only shown if rated */}
                    {setRating > 0 && (
                      <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                        {[1,2,3,4,5].map(s => (
                          <span key={s} style={{ fontSize: '0.72rem', color: s <= setRating ? '#fbbf24' : 'rgba(255,255,255,0.15)' }}>★</span>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <button 
              className="btn btn-primary" 
              onClick={onClose}
              style={{ borderRadius: 0, padding: 16 }}
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
