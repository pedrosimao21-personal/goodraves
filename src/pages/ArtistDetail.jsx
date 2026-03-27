import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { getArtistInfo, getArtistTopTracks as getLastfmTopTracks } from '../api/lastfm'
import { searchArtist as spotifySearch, getArtistAlbums, HAS_SPOTIFY } from '../api/spotify'
import { useUserData } from '../context/UserDataContext'

const HAS_LASTFM = import.meta.env.VITE_LASTFM_KEY &&
  import.meta.env.VITE_LASTFM_KEY !== 'your_lastfm_api_key_here'

function BackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
    </svg>
  )
}

function ResidentAdvisorIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2zm1 4h-4v12h2v-4h1l2 4h2.2l-2.2-4.4C14.1 13.2 15 12.2 15 11V9c0-1.7-1.3-3-3-3l1-2zm-1 2c.6 0 1 .4 1 1v2c0 .6-.4 1-1 1h-2V8h2z"/>
    </svg>
  )
}

function SpotifyIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#1DB954">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
    </svg>
  )
}

function formatPlaycount(n) {
  if (!n) return ''
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M plays`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K plays`
  return `${n} plays`
}

function formatFollowers(n) {
  if (!n) return ''
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return `${n}`
}

/** Component that lazy-loads a similar artist photo via Spotify */
function SimilarArtistCard({ artistName, defaultImg, onClick }) {
  const [img, setImg] = useState(defaultImg)

  useEffect(() => {
    if (img || !HAS_SPOTIFY) return
    let cancelled = false
    spotifySearch(artistName)
      .then(sp => {
        if (!cancelled && sp?.image) setImg(sp.image)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [artistName, img])

  return (
    <button
      className="related-artist-card"
      onClick={onClick}
      id={`related-${artistName.replace(/\\s+/g, '-').toLowerCase()}`}
    >
      {img ? (
        <img className="related-artist-img" src={img} alt={artistName} loading="lazy" />
      ) : (
        <div className="related-artist-img-placeholder">🎤</div>
      )}
      <span className="related-artist-name">{artistName}</span>
    </button>
  )
}

export default function ArtistDetail() {
  const { name: encodedName } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const artistId = searchParams.get('id') ?? encodedName
  const artistName = decodeURIComponent(encodedName)

  // Last.fm state
  const [lastfmInfo, setLastfmInfo] = useState(null)
  const [lastfmTracks, setLastfmTracks] = useState([])

  // Spotify state
  const [spotifyArtist, setSpotifyArtist] = useState(null)
  const [spotifyAlbums, setSpotifyAlbums] = useState([])

  const [loading, setLoading] = useState(true)
  const [noKey, setNoKey] = useState(false)

  useEffect(() => {
    let cancelled = false

    if (!HAS_LASTFM && !HAS_SPOTIFY) {
      setNoKey(true)
      setLoading(false)
      return
    }

    setLoading(true)

    const fetches = []

    // Last.fm fetches
    if (HAS_LASTFM) {
      fetches.push(
        getArtistInfo(artistName).catch(() => null),
        getLastfmTopTracks(artistName, 8).catch(() => []),
      )
    } else {
      fetches.push(null, [])
    }

    // Spotify fetches
    if (HAS_SPOTIFY) {
      fetches.push(
        spotifySearch(artistName).catch(() => null),
      )
    } else {
      fetches.push(null)
    }

    Promise.all(fetches).then(async ([lfmInfo, lfmTracks, spArtist]) => {
      if (cancelled) return

      setLastfmInfo(lfmInfo)
      setLastfmTracks(lfmTracks ?? [])

      if (spArtist) {
        setSpotifyArtist(spArtist)
        // Fetch Spotify albums
        const spAlbums = await getArtistAlbums(spArtist.id).catch(() => [])
        if (!cancelled) {
          // Sort albums by year descending
          spAlbums.sort((a, b) => (b.releaseDate || '').localeCompare(a.releaseDate || ''))
          setSpotifyAlbums(spAlbums)
        }
      }

      setLoading(false)
    })

    return () => { cancelled = true }
  }, [artistName])

  // Merge data: Spotify preferred for image, both for tags
  const displayImage = spotifyArtist?.image ?? lastfmInfo?.image ?? null
  const displayName = spotifyArtist?.name ?? lastfmInfo?.name ?? artistName

  // Merge genres/tags — deduplicate
  const mergedTags = (() => {
    const tags = new Set()
    const spGenres = Array.isArray(spotifyArtist?.genres) ? spotifyArtist.genres : []
    const lfTags = Array.isArray(lastfmInfo?.tags) ? lastfmInfo.tags : []
    spGenres.forEach(g => tags.add(g))
    lfTags.forEach(t => tags.add(t))
    return [...tags].slice(0, 8)
  })()

  // Show Spotify releases if we have them
  const hasReleases = spotifyAlbums.length > 0

  return (
    <div className="page">
      <div className="container" style={{ paddingTop: 32 }}>
        <button className="festival-hero-back" onClick={() => navigate(-1)} id="artist-back-btn">
          <BackIcon /> Back
        </button>

        <div className="artist-detail-header">
          {displayImage ? (
            <img className="artist-detail-img" src={displayImage} alt={artistName} />
          ) : (
            <div className="artist-detail-img-placeholder">🎤</div>
          )}

          <div className="artist-detail-info">
            <h1 className="artist-detail-name">{displayName}</h1>

            {mergedTags.length > 0 && (
              <div className="artist-detail-tags">
                {mergedTags.map(tag => (
                  <span key={tag} className="tag">{tag}</span>
                ))}
              </div>
            )}

            {/* Stats row */}
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 12 }}>
              {spotifyArtist?.followers > 0 && (
                <span className="artist-stat">
                  <SpotifyIcon size={14} />
                  {formatFollowers(spotifyArtist.followers)} followers
                </span>
              )}
              {lastfmInfo?.listeners && (
                <span className="artist-stat">
                  👥 {parseInt(lastfmInfo.listeners, 10).toLocaleString()} Last.fm listeners
                </span>
              )}
            </div>

            {/* Action links */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
              {spotifyArtist?.url && (
                <a
                  href={spotifyArtist.url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn spotify-link btn-sm"
                  id="spotify-link"
                >
                  <SpotifyIcon size={16} /> Open in Spotify
                </a>
              )}
              {lastfmInfo?.url && (
                <a
                  href={lastfmInfo.url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secondary btn-sm"
                  id="lastfm-link"
                >
                  View on Last.fm ↗
                </a>
              )}
              <a
                href={`https://ra.co/dj/${artistName.toLowerCase().replace(/\\s+/g, '-')}`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-secondary btn-sm ra-link"
                id="ra-link"
              >
                <ResidentAdvisorIcon size={16} /> Resident Advisor
              </a>
            </div>
          </div>
        </div>

        <div className="divider" />

        {!HAS_LASTFM && !HAS_SPOTIFY && (
          <div className="api-notice">
            <span className="api-notice-icon">⚠️</span>
            <div className="api-notice-text">
              <strong>No API keys set</strong>
              Add <code>VITE_LASTFM_KEY</code> and/or <code>VITE_SPOTIFY_CLIENT_ID</code> + <code>VITE_SPOTIFY_CLIENT_SECRET</code> to your <code>.env</code> to see artist details.
            </div>
          </div>
        )}

        {loading && (
          <div>
            <div className="skeleton" style={{ height: 24, width: '30%', marginBottom: 16 }} />
            <div className="skeleton" style={{ height: 120, marginBottom: 24 }} />
          </div>
        )}

        {/* Bio (Last.fm only) */}
        {lastfmInfo?.bio && !loading && (
          <div style={{ marginBottom: 32 }}>
            <h2 className="section-title" style={{ marginBottom: 12 }}>About</h2>
            <div className="artist-bio">
              {lastfmInfo.bio.split('\\n').filter(Boolean).map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          </div>
        )}

        {/* Latest Releases (Spotify) */}
        {hasReleases && !loading && (
          <div style={{ marginBottom: 40 }}>
            <h2 className="section-title" style={{ marginBottom: 16 }}>
              Latest Releases
              <span className="spotify-badge-inline"><SpotifyIcon size={13} /></span>
            </h2>
            <div className="album-grid">
              {spotifyAlbums.map(album => (
                <a key={album.id} href={album.url} target="_blank" rel="noreferrer" className="album-card">
                  <div className="album-img-wrap">
                    {album.image ? (
                      <img src={album.image} alt={album.name} loading="lazy" />
                    ) : (
                      <div className="album-placeholder">💿</div>
                    )}
                    <div className="album-type-badge">{album.type}</div>
                  </div>
                  <div className="album-info">
                    <div className="album-name" title={album.name}>{album.name}</div>
                    <div className="album-date">{album.releaseDate ? new Date(album.releaseDate).getFullYear() : ''}</div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Top Tracks (Last.fm API mapped to Spotify Search link) */}
        {lastfmTracks.length > 0 && !loading && (
          <div style={{ marginBottom: 40 }}>
            <h2 className="section-title" style={{ marginBottom: 16 }}>Top Tracks</h2>
            <ul className="track-list" id="top-tracks-list">
              {lastfmTracks.map((t, i) => {
                const spotifySearchUrl = `https://open.spotify.com/search/${encodeURIComponent(artistName + ' ' + t.name)}/tracks`
                return (
                  <li key={t.name + i} className="track-item">
                    <span className="track-num">{i + 1}</span>
                    <div className="track-info">
                      <a href={spotifySearchUrl} target="_blank" rel="noreferrer" className="track-name" style={{ color: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {t.name}
                        <SpotifyIcon size={12} />
                      </a>
                    </div>
                    {t.playcount > 0 && (
                      <span className="track-plays">{formatPlaycount(t.playcount)}</span>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {/* Similar Artists (Last.fm backed by Spotify images) */}
        {(lastfmInfo?.similar?.length > 0) && !loading && (
          <div>
            <h2 className="section-title" style={{ marginBottom: 16 }}>Similar Artists</h2>
            <div className="related-artists-grid">
              {lastfmInfo.similar.map(a => (
                <SimilarArtistCard
                  key={a.name}
                  artistName={a.name}
                  defaultImg={a.image}
                  onClick={() => navigate(`/artist/${encodeURIComponent(a.name)}?id=${encodeURIComponent(a.name)}`)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
