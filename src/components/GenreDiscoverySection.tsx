'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  getGenreDiscoveryData,
  DEFAULT_GENRES,
  type GenreDiscoveryData,
} from '@/db/actions/genre-discovery'
import { SpotifyIcon } from '@/components/icons'

type Props = {
  initialGenre?: string
}

const GENRE_OPTIONS = [
  { value: 'techno', label: 'Techno' },
  { value: 'house', label: 'House' },
  { value: 'trance', label: 'Trance' },
  { value: 'drum and bass', label: 'Drum & Bass' },
  { value: 'ambient', label: 'Ambient' },
  { value: 'melodic techno', label: 'Melodic Techno' },
  { value: 'deep house', label: 'Deep House' },
  { value: 'tech house', label: 'Tech House' },
  { value: 'minimal', label: 'Minimal' },
  { value: 'hardstyle', label: 'Hardstyle' },
]

function ArtistAvatar({ name, image }: { name: string; image: string | null }) {
  if (image) {
    return (
      <Image
        src={image}
        alt={name}
        width={56}
        height={56}
        className="genre-discovery-avatar"
        style={{ objectFit: 'cover', borderRadius: '50%' }}
      />
    )
  }
  return (
    <div className="genre-discovery-avatar-placeholder">
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

function TrackImage({ name, image }: { name: string; image: string | null }) {
  if (image) {
    return (
      <Image
        src={image}
        alt={name}
        width={48}
        height={48}
        style={{ objectFit: 'cover', borderRadius: 6 }}
      />
    )
  }
  return (
    <div style={{
      width: 48,
      height: 48,
      borderRadius: 6,
      background: 'var(--gradient-card)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '1.2rem',
      flexShrink: 0,
    }}>
      🎵
    </div>
  )
}

export default function GenreDiscoverySection({ initialGenre }: Props) {
  const [selectedGenre, setSelectedGenre] = useState(initialGenre ?? DEFAULT_GENRES[0])
  const [data, setData] = useState<GenreDiscoveryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)

    getGenreDiscoveryData(selectedGenre)
      .then((result) => {
        if (!cancelled) {
          setData(result)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true)
          setLoading(false)
        }
      })

    return () => { cancelled = true }
  }, [selectedGenre])

  return (
    <section className="genre-discovery-section">
      <div className="genre-discovery-header">
        <h2 className="section-title" style={{ margin: 0 }}>
          Explore by Genre
        </h2>
        <select
          value={selectedGenre}
          onChange={(e) => setSelectedGenre(e.target.value)}
          className="genre-discovery-select"
          aria-label="Select genre"
        >
          {GENRE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {loading && (
        <div className="genre-discovery-loading">
          <div className="genre-discovery-grid">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 80, borderRadius: 12 }} />
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="genre-discovery-empty">
          <p>Unable to load genre data. Please try again later.</p>
        </div>
      )}

      {!loading && !error && data && (
        <div className="genre-discovery-content">
          {/* Top Artists */}
          {data.artists.length > 0 && (
            <div className="genre-discovery-subsection">
              <h3 className="genre-discovery-subtitle">
                Top {data.displayName} Artists
              </h3>
              <div className="genre-discovery-artists-grid">
                {data.artists.map((artist) => (
                  <Link
                    key={artist.name}
                    href={`https://open.spotify.com/search/${encodeURIComponent(artist.name)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="genre-discovery-artist-card"
                  >
                    <ArtistAvatar name={artist.name} image={artist.image} />
                    <span className="genre-discovery-artist-name">{artist.name}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Top Tracks */}
          {data.tracks.length > 0 && (
            <div className="genre-discovery-subsection">
              <h3 className="genre-discovery-subtitle">
                Top {data.displayName} Tracks
              </h3>
              <div className="genre-discovery-tracks-list">
                {data.tracks.map((track, idx) => (
                  <a
                    key={`${track.artist}-${track.name}-${idx}`}
                    href={`https://open.spotify.com/search/${encodeURIComponent(`${track.artist} ${track.name}`)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="genre-discovery-track-row"
                  >
                    <TrackImage name={track.name} image={track.image} />
                    <div className="genre-discovery-track-info">
                      <span className="genre-discovery-track-name">{track.name}</span>
                      <span className="genre-discovery-track-artist">{track.artist}</span>
                    </div>
                    <SpotifyIcon size={16} />
                  </a>
                ))}
              </div>
            </div>
          )}

          {data.artists.length === 0 && data.tracks.length === 0 && (
            <div className="genre-discovery-empty">
              <p>No results found for {data.displayName}. Try another genre!</p>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
