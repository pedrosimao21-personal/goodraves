import { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUserData } from '../context/UserDataContext'
import { searchArtist, HAS_SPOTIFY } from '../api/spotify'
import { getArtistInfo } from '../api/lastfm'
function SpotifyIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#1DB954">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
    </svg>
  )
}

/** Hook to batch-fetch Spotify data for a list of artist names */
function useSpotifyEnrichment(artistNames, onEnrich) {
  const [data, setData] = useState({})

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
          
          // Try Spotify
          if (HAS_SPOTIFY) {
            try {
              const sp = await searchArtist(name)
              if (sp) {
                genres = sp.genres || []
                image = sp.image
              }
            } catch (e) {
              console.warn(`Spotify search failed for ${name}`, e)
            }
          }

          // Fallback to Last.fm if no genres found
          if (genres.length === 0) {
            try {
              const info = await getArtistInfo(name)
              if (info) {
                genres = info.tags || []
                if (!image) image = info.image
              }
            } catch (e) {}
          }
          
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
  const navigate = useNavigate()
  const { getArtistSeenCounts, artistMeta, artistRatings, getFestivalMeta, batchEnrichArtists } = useUserData()

  // Build ranked list of artists by # of times seen
  const ranking = useMemo(() => {
    const counts = getArtistSeenCounts()
    return Object.entries(counts)
      .map(([artistId, { count, events }]) => {
        const meta = artistMeta[artistId]
        const rating = artistRatings[artistId] ?? 0
        // Get festival names for each event
        const festivals = events.map(eid => {
          const fm = getFestivalMeta(eid)
          return {
            id: eid,
            name: fm?.name ?? eid,
            date: fm?.date ?? null,
          }
        })
        return {
          id: artistId,
          name: meta?.name ?? artistId,
          image: meta?.image ?? null,
          count,
          rating,
          festivals,
        }
      })
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count
        if (b.rating !== a.rating) return b.rating - a.rating
        return a.name.localeCompare(b.name)
      })
  }, [getArtistSeenCounts, artistMeta, artistRatings, getFestivalMeta])

  // Fetch Spotify data for ranked artists (up to 15)
  // Fetch Spotify data only for artists with missing data (up to 15)
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
        // Only update if genres are actually found or image is better
        const hasNewGenres = enriched.genres && enriched.genres.length > 0
        const hasExistingGenres = (artistMeta[artist.id]?.genres ?? []).length > 0
        
        if (hasNewGenres || !hasExistingGenres) {
          metaUpdates[artist.id] = {
            name: enriched.name || artist.name,
            image: enriched.image || artist.image,
            genres: hasNewGenres ? enriched.genres : (artistMeta[artist.id]?.genres || []),
            spotifyUrl: enriched.url || null,
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

  return (
    <div className="page">
      <div className="container">
        <div style={{ paddingTop: 8, marginBottom: 32 }}>
          <h1 className="section-title" style={{ fontSize: '2rem', fontFamily: 'var(--font-display)', fontWeight: 800, marginBottom: 6 }}>
            Most Watched DJs
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Your all-time ranking of artists by number of live performances seen
          </p>
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
              <div className="stat-value">{totalSeen}</div>
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
            <p>Go to a festival page and mark artists you've seen to start building your ranking.</p>
            <button className="btn btn-primary" onClick={() => navigate('/')} id="go-discover-djs">
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
                  onClick={() => navigate(`/artist/${encodeURIComponent(artist.name)}?id=${artist.id}`)}
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
                      <img
                        src={displayImage}
                        alt={artist.name}
                        style={{ width: 50, height: 50, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border)' }}
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
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', marginBottom: 2 }}>
                      {artist.festivals.map(f => f.name).join(' • ')}
                    </div>
                    {/* Genres */}
                    {((sp?.genres?.length > 0) || (artistMeta[artist.id]?.genres?.length > 0)) && (
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 4 }}>
                        {(sp?.genres || artistMeta[artist.id]?.genres || []).slice(0, 3).map(g => (
                          <span key={g} style={{ fontSize: '0.68rem', padding: '1px 8px', borderRadius: 999, background: 'rgba(29, 185, 84, 0.12)', color: 'var(--accent)', border: '1px solid rgba(139, 92, 246, 0.25)', textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
                            {g}
                          </span>
                        ))}
                      </div>
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
      </div>
    </div>
  )
}
