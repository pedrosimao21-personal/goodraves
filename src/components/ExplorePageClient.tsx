'use client'

import { useState, useTransition, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { SpotifyIcon } from '@/components/icons'
import type { ExploreData, ArtistWithLink } from '@/db/actions/explore'
import type { TopTag } from '@/services/lastfm/client'
import type { TrendingFestival } from '@/db/actions/trending-festivals'
import type { NearbyShow } from '@/db/actions/nearby-shows'
import { getNearbyShows } from '@/db/actions/nearby-shows'
import { formatDate } from '@/lib/format-date'

// ── Constants ──────────────────────────────────────────────────────────────

const NEARBY_SHOWS_STORAGE_KEY = 'explore_nearby_city'

// ── Types ──────────────────────────────────────────────────────────────────

type Props = {
  initialData: ExploreData
  suggestedTags: TopTag[]
  genreOptions: { value: string; label: string }[]
  trendingFestivals: TrendingFestival[]
  userCity: string | null
  isAuthenticated: boolean
}

// ── Small presentational components ────────────────────────────────────────

function ArtistAvatar({ name, image }: { name: string; image: string | null }) {
  if (image) {
    return (
      <Image
        src={image}
        alt={name}
        width={72}
        height={72}
        className="explore-artist-avatar"
        style={{ objectFit: 'cover' }}
      />
    )
  }
  return (
    <div className="explore-artist-avatar-placeholder">
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

function AlbumArt({ name, image }: { name: string; image: string | null }) {
  if (image) {
    return (
      <Image
        src={image}
        alt={name}
        width={120}
        height={120}
        className="explore-album-art"
        style={{ objectFit: 'cover' }}
      />
    )
  }
  return (
    <div className="explore-album-art-placeholder">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
        <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
      </svg>
    </div>
  )
}

function TrackArt({ name, image }: { name: string; image: string | null }) {
  if (image) {
    return (
      <Image
        src={image}
        alt={name}
        width={48}
        height={48}
        style={{ objectFit: 'cover', borderRadius: 6, flexShrink: 0 }}
      />
    )
  }
  return (
    <div className="explore-track-art-placeholder">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.5 }}>
        <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
      </svg>
    </div>
  )
}

// ── Artist card — links to Goodraves profile if available, else Spotify ────

function ArtistCard({ artist }: { artist: ArtistWithLink }) {
  const href = artist.goodravesId
    ? `/artist/${artist.goodravesId}/${encodeURIComponent(artist.name)}`
    : `https://open.spotify.com/search/${encodeURIComponent(artist.name)}`

  const isExternal = !artist.goodravesId

  return (
    <a
      href={href}
      target={isExternal ? '_blank' : undefined}
      rel={isExternal ? 'noreferrer' : undefined}
      className="explore-artist-card"
    >
      <div className="explore-artist-avatar-wrap">
        <ArtistAvatar name={artist.name} image={artist.image} />
        {artist.goodravesId && (
          <span className="explore-artist-goodraves-badge" title="On Goodraves">
            <svg width="10" height="10" viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="16" r="15" stroke="url(#eGrad)" strokeWidth="2.5" />
              <circle cx="16" cy="16" r="6" fill="url(#eGrad)" />
              <defs>
                <linearGradient id="eGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#8b5cf6" />
                  <stop offset="100%" stopColor="#ec4899" />
                </linearGradient>
              </defs>
            </svg>
          </span>
        )}
        {!artist.goodravesId && (
          <span className="explore-artist-spotify-badge">
            <SpotifyIcon size={12} />
          </span>
        )}
      </div>
      <span className="explore-artist-name">{artist.name}</span>
      {artist.listeners > 0 && (
        <span className="explore-artist-listeners">{formatCount(artist.listeners)} listeners</span>
      )}
    </a>
  )
}

// ── Track row — links to Spotify search ────────────────────────────────────

function TrackRow({
  track,
  rank,
}: {
  track: ExploreData['tracks'][number]
  rank: number
}) {
  const spotifyHref = `https://open.spotify.com/search/${encodeURIComponent(`${track.artist} ${track.name}`)}`

  return (
    <a
      href={spotifyHref}
      target="_blank"
      rel="noreferrer"
      className="explore-track-row"
    >
      <span className="explore-track-rank">{rank}</span>
      <TrackArt name={track.name} image={track.image} />
      <div className="explore-track-info">
        <span className="explore-track-name">{track.name}</span>
        <span className="explore-track-artist">{track.artist}</span>
      </div>
      <SpotifyIcon size={16} />
    </a>
  )
}

// ── Album card — links to Spotify search ───────────────────────────────────

function AlbumCard({ album }: { album: ExploreData['albums'][number] }) {
  const spotifyHref = `https://open.spotify.com/search/${encodeURIComponent(`${album.artist} ${album.name}`)}`

  return (
    <a
      href={spotifyHref}
      target="_blank"
      rel="noreferrer"
      className="explore-album-card"
    >
      <div className="explore-album-art-wrap">
        <AlbumArt name={album.name} image={album.image} />
        <span className="explore-album-spotify-overlay">
          <SpotifyIcon size={18} />
        </span>
      </div>
      <div className="explore-album-info">
        <span className="explore-album-name">{album.name}</span>
        <span className="explore-album-artist">{album.artist}</span>
      </div>
    </a>
  )
}

// ── Skeleton loaders ────────────────────────────────────────────────────────

function ArtistsSkeleton() {
  return (
    <div className="explore-artists-grid">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height: 120, borderRadius: 12 }} />
      ))}
    </div>
  )
}

function TracksSkeleton() {
  return (
    <div className="explore-tracks-list">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height: 64, borderRadius: 10 }} />
      ))}
    </div>
  )
}

function AlbumsSkeleton() {
  return (
    <div className="explore-albums-grid">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height: 160, borderRadius: 12 }} />
      ))}
    </div>
  )
}

// ── Tag info header ─────────────────────────────────────────────────────────

function TagInfoHeader({ info, displayName }: { info: ExploreData['info']; displayName: string }) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (!info) return null

  const hasWiki = Boolean(info.wiki && info.wiki.length > 40)
  const shortWiki = hasWiki && info.wiki
    ? info.wiki.slice(0, 220) + (info.wiki.length > 220 ? '…' : '')
    : null

  return (
    <div className="explore-tag-info">
      <div className="explore-tag-info-stats">
        {info.reach > 0 && (
          <span className="explore-tag-stat">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            {formatCount(info.reach)} listeners
          </span>
        )}
        {info.taggings > 0 && (
          <span className="explore-tag-stat">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
              <line x1="7" y1="7" x2="7.01" y2="7"/>
            </svg>
            {formatCount(info.taggings)} tags
          </span>
        )}
      </div>
      {hasWiki && shortWiki && (
        <p className="explore-tag-wiki">
          {isExpanded ? info.wiki : shortWiki}
          {info.wiki && info.wiki.length > 220 && (
            <button
              className="explore-tag-wiki-toggle"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? ' Show less' : ' Show more'}
            </button>
          )}
        </p>
      )}
    </div>
  )
}

// ── Genre search with autocomplete ─────────────────────────────────────────

function GenreSearchBar({
  genreOptions,
  currentGenre,
  onSelect,
}: {
  genreOptions: { value: string; label: string }[]
  currentGenre: string
  onSelect: (value: string) => void
}) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const filtered = query.trim()
    ? genreOptions.filter((o) =>
        o.label.toLowerCase().includes(query.toLowerCase())
      )
    : genreOptions

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleSelect(value: string) {
    setQuery('')
    setIsOpen(false)
    onSelect(value)
  }

  const currentLabel = genreOptions.find((o) => o.value === currentGenre)?.label ?? currentGenre

  return (
    <div className="explore-search-wrap" ref={containerRef}>
      <div className="explore-search-input-wrap">
        <svg
          className="explore-search-icon"
          width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          type="text"
          className="explore-search-input"
          placeholder={`Search genres… (${currentLabel})`}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setIsOpen(true) }}
          onFocus={() => setIsOpen(true)}
          aria-label="Search genres"
          aria-expanded={isOpen}
          aria-autocomplete="list"
        />
      </div>
      {isOpen && filtered.length > 0 && (
        <ul className="explore-search-dropdown" role="listbox">
          {filtered.map((option) => (
            <li
              key={option.value}
              className={`explore-search-option${option.value === currentGenre ? ' active' : ''}`}
              role="option"
              aria-selected={option.value === currentGenre}
              onMouseDown={() => handleSelect(option.value)}
            >
              {option.label}
              {option.value === currentGenre && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Trending Festivals section ──────────────────────────────────────────────

function CalendarIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}

function MapPinIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" />
    </svg>
  )
}

function FestivalThumbnail({ festival }: { festival: TrendingFestival }) {
  if (festival.imageUrl) {
    return (
      <Image
        src={festival.imageUrl}
        alt={festival.name}
        width={60}
        height={60}
        className="upcoming-festival-thumb"
        style={{ objectFit: 'cover' }}
      />
    )
  }
  return (
    <div className="upcoming-festival-thumb upcoming-festival-thumb-placeholder">🎪</div>
  )
}

function TrendingFestivalRow({ festival }: { festival: TrendingFestival }) {
  return (
    <Link href={`/festival/${festival.id}`} className="upcoming-festival-row">
      <FestivalThumbnail festival={festival} />
      <div className="upcoming-festival-info">
        <span className="upcoming-festival-name">{festival.name}</span>
        <div className="upcoming-festival-meta">
          <span className="upcoming-festival-meta-item">
            <CalendarIcon />
            {formatDate(festival.date)}
          </span>
          {festival.location && (
            <span className="upcoming-festival-meta-item">
              <MapPinIcon />
              {festival.location}
            </span>
          )}
          {festival.distanceKm !== null && (
            <span className="upcoming-festival-distance">
              {Math.round(festival.distanceKm)} km away
            </span>
          )}
          <span className="trending-badge">
            🔥 {festival.interestedCount.toLocaleString()} interested
          </span>
        </div>
      </div>
    </Link>
  )
}

function TrendingFestivalsSection({
  festivals,
  userCity,
}: {
  festivals: TrendingFestival[]
  userCity: string | null
}) {
  if (festivals.length === 0) return null

  const sectionTitle = userCity
    ? `Trending Festivals near ${userCity}`
    : 'Trending Festivals'

  return (
    <section className="upcoming-festivals-section">
      <div className="upcoming-festivals-header">
        <h2 className="upcoming-festivals-title">{sectionTitle}</h2>
        <Link href="/search?type=festivals" className="upcoming-festivals-view-all">
          View all
        </Link>
      </div>
      <div className="upcoming-festivals-list">
        {festivals.map((festival) => (
          <TrendingFestivalRow key={festival.id} festival={festival} />
        ))}
      </div>
    </section>
  )
}

// ── Nearby Shows section ────────────────────────────────────────────────────

function NearbyShowThumbnail({ show }: { show: NearbyShow }) {
  if (show.imageUrl) {
    return (
      <Image
        src={show.imageUrl}
        alt={show.name}
        width={60}
        height={60}
        className="upcoming-festival-thumb"
        style={{ objectFit: 'cover' }}
      />
    )
  }
  return (
    <div className="upcoming-festival-thumb upcoming-festival-thumb-placeholder">📍</div>
  )
}

function NearbyShowRow({ show }: { show: NearbyShow }) {
  return (
    <Link href={`/festival/${show.id}`} className="upcoming-festival-row">
      <NearbyShowThumbnail show={show} />
      <div className="upcoming-festival-info">
        <span className="upcoming-festival-name">{show.name}</span>
        <div className="upcoming-festival-meta">
          <span className="upcoming-festival-meta-item">
            <CalendarIcon />
            {formatDate(show.date)}
          </span>
          {(show.location || show.venue) && (
            <span className="upcoming-festival-meta-item">
              <MapPinIcon />
              {show.location ?? show.venue}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}

function NearbyShowsSection({
  initialShows,
  userCity,
  isAuthenticated,
}: {
  initialShows: NearbyShow[]
  userCity: string | null
  isAuthenticated: boolean
}) {
  const [city, setCity] = useState<string>(() => {
    if (userCity) return userCity
    if (typeof window !== 'undefined') {
      return localStorage.getItem(NEARBY_SHOWS_STORAGE_KEY) ?? ''
    }
    return ''
  })
  const [shows, setShows] = useState<NearbyShow[]>(initialShows)
  const [inputValue, setInputValue] = useState(city)
  const [isLoading, setIsLoading] = useState(false)

  const fetchShows = useCallback((targetCity: string) => {
    if (!targetCity.trim()) return
    setIsLoading(true)
    getNearbyShows(targetCity)
      .then((results) => {
        setShows(results)
        setIsLoading(false)
      })
      .catch(() => setIsLoading(false))
  }, [])

  function handleCitySubmit() {
    const trimmed = inputValue.trim()
    if (!trimmed) return
    setCity(trimmed)
    if (!isAuthenticated && typeof window !== 'undefined') {
      localStorage.setItem(NEARBY_SHOWS_STORAGE_KEY, trimmed)
    }
    fetchShows(trimmed)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleCitySubmit()
  }

  // Authenticated users: use server-provided city and shows, no input needed
  if (isAuthenticated && userCity) {
    return (
      <section className="upcoming-festivals-section">
        <div className="upcoming-festivals-header">
          <h2 className="upcoming-festivals-title">Shows near {userCity}</h2>
          <Link href="/profile" className="upcoming-festivals-view-all">
            Change location
          </Link>
        </div>
        {shows.length > 0 ? (
          <div className="upcoming-festivals-list">
            {shows.map((show) => (
              <NearbyShowRow key={show.id} show={show} />
            ))}
          </div>
        ) : (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            No upcoming shows found near {userCity}.
          </p>
        )}
      </section>
    )
  }

  // Unauthenticated or authenticated without city: show location input
  return (
    <section className="upcoming-festivals-section">
      <div className="upcoming-festivals-header">
        <h2 className="upcoming-festivals-title">
          {city ? `Shows near ${city}` : 'Shows Near You'}
        </h2>
      </div>

      {!city && (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 12 }}>
          Enter your city to discover upcoming shows near you.
        </p>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. Amsterdam"
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: 10,
            border: '1px solid var(--border)',
            background: 'var(--bg-card)',
            color: 'inherit',
            fontSize: '0.95rem',
          }}
        />
        <button
          className="btn btn-primary btn-sm"
          onClick={handleCitySubmit}
          disabled={isLoading || !inputValue.trim()}
          style={{ minWidth: 72 }}
        >
          {isLoading ? '...' : 'Search'}
        </button>
      </div>

      {city && !isLoading && shows.length === 0 && (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          No upcoming shows found near {city}.
        </p>
      )}

      {shows.length > 0 && (
        <div className="upcoming-festivals-list">
          {shows.map((show) => (
            <NearbyShowRow key={show.id} show={show} />
          ))}
        </div>
      )}
    </section>
  )
}

// ── Main client component ───────────────────────────────────────────────────

export default function ExplorePageClient({
  initialData,
  suggestedTags,
  genreOptions,
  trendingFestivals,
  userCity,
  isAuthenticated,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [activeData, setActiveData] = useState<ExploreData>(initialData)

  // Sync when the server navigates to a new genre
  useEffect(() => {
    setActiveData(initialData)
  }, [initialData])

  function navigateToGenre(genre: string) {
    startTransition(() => {
      router.push(`/explore/${encodeURIComponent(genre)}`)
    })
  }

  const { displayName, info, artists, tracks, albums, similarTags } = activeData

  return (
    <div className="page">
      {/* ── Page hero ── */}
      <div className="explore-hero">
        <div className="container">
          <div className="explore-hero-badge">Genre Explorer</div>
          <h1 className="explore-hero-title">Explore Music Genres</h1>
          <p className="explore-hero-desc">
            Discover top artists, tracks, and albums for any electronic music genre — powered by Last.fm.
          </p>

          <GenreSearchBar
            genreOptions={genreOptions}
            currentGenre={activeData.genre}
            onSelect={navigateToGenre}
          />
        </div>
      </div>

      <div className="container">
        {/* ── Trending Festivals ── */}
        <TrendingFestivalsSection
          festivals={trendingFestivals}
          userCity={userCity}
        />

        {/* ── Nearby Shows ── */}
        <NearbyShowsSection
          initialShows={[]}
          userCity={userCity}
          isAuthenticated={isAuthenticated}
        />

        {/* ── Selected genre header ── */}
        <div className={`explore-genre-header${isPending ? ' explore-loading' : ''}`}>
          <h2 className="explore-genre-title">{displayName}</h2>
          {isPending && <div className="loading-spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />}
        </div>

        <TagInfoHeader info={info} displayName={displayName} />

        {/* ── Similar tags ── */}
        {similarTags.length > 0 && (
          <div className="explore-similar-tags">
            <span className="explore-similar-label">Similar:</span>
            {similarTags.slice(0, 8).map((tagName) => {
              const matchedOption = genreOptions.find(
                (o) => o.value === tagName.toLowerCase() || o.label.toLowerCase() === tagName.toLowerCase()
              )
              return (
                <button
                  key={tagName}
                  className="chip explore-similar-chip"
                  onClick={() => navigateToGenre(matchedOption?.value ?? tagName.toLowerCase())}
                >
                  {matchedOption?.label ?? tagName}
                </button>
              )
            })}
          </div>
        )}

        <div className="explore-divider" />

        {/* ── Top Artists ── */}
        <section className="explore-section">
          <div className="explore-section-header">
            <h3 className="explore-section-title">Top Artists</h3>
            <span className="explore-section-subtitle">via Last.fm · ranked by listeners</span>
          </div>
          {isPending ? (
            <ArtistsSkeleton />
          ) : artists.length > 0 ? (
            <div className="explore-artists-grid">
              {artists.map((artist) => (
                <ArtistCard key={artist.name} artist={artist} />
              ))}
            </div>
          ) : (
            <EmptySection label="artists" genre={displayName} />
          )}
        </section>

        <div className="explore-divider" />

        {/* ── Top Tracks ── */}
        <section className="explore-section">
          <div className="explore-section-header">
            <h3 className="explore-section-title">Top Tracks</h3>
            <span className="explore-section-subtitle">via Last.fm</span>
          </div>
          {isPending ? (
            <TracksSkeleton />
          ) : tracks.length > 0 ? (
            <div className="explore-tracks-list">
              {tracks.map((track, idx) => (
                <TrackRow
                  key={`${track.artist}-${track.name}-${idx}`}
                  track={track}
                  rank={idx + 1}
                />
              ))}
            </div>
          ) : (
            <EmptySection label="tracks" genre={displayName} />
          )}
        </section>

        <div className="explore-divider" />

        {/* ── Top Albums ── */}
        <section className="explore-section" style={{ marginBottom: 64 }}>
          <div className="explore-section-header">
            <h3 className="explore-section-title">Top Albums</h3>
            <span className="explore-section-subtitle">via Last.fm</span>
          </div>
          {isPending ? (
            <AlbumsSkeleton />
          ) : albums.length > 0 ? (
            <div className="explore-albums-grid">
              {albums.map((album) => (
                <AlbumCard key={`${album.artist}-${album.name}`} album={album} />
              ))}
            </div>
          ) : (
            <EmptySection label="albums" genre={displayName} />
          )}
        </section>
      </div>
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────

function EmptySection({ label, genre }: { label: string; genre: string }) {
  return (
    <div className="genre-discovery-empty">
      <p>No {label} found for {genre}.</p>
    </div>
  )
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}
