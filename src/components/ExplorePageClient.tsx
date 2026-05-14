'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { SpotifyIcon } from '@/components/icons'
import type { ExploreData, ArtistWithLink } from '@/db/actions/explore'
import type { TopTag } from '@/services/lastfm/client'

// ── Types ──────────────────────────────────────────────────────────────────

type Props = {
  initialData: ExploreData
  suggestedTags: TopTag[]
  genreOptions: { value: string; label: string }[]
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

// ── Main client component ───────────────────────────────────────────────────

export default function ExplorePageClient({
  initialData,
  suggestedTags,
  genreOptions,
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

  const suggestedGenreValues = new Set(suggestedTags.map((t) => t.name.toLowerCase()))
  const popularChips = genreOptions.filter((o) => suggestedGenreValues.has(o.value))
  const extraChips = genreOptions.filter((o) => !suggestedGenreValues.has(o.value))
  const allChips = [...popularChips, ...extraChips]

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

          {/* Genre chip row */}
          <div className="explore-genre-chips">
            {allChips.map((option) => (
              <button
                key={option.value}
                className={`chip explore-genre-chip${option.value === activeData.genre ? ' active' : ''}`}
                onClick={() => navigateToGenre(option.value)}
                aria-pressed={option.value === activeData.genre}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="container">
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
            <span className="explore-section-subtitle">via Last.fm · ranked by tag count</span>
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
            <span className="explore-section-subtitle">via Last.fm · ranked by tag count</span>
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
            <span className="explore-section-subtitle">via Last.fm · ranked by tag count</span>
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
