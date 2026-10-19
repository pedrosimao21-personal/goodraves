'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import FollowButton from '@/components/FollowButton'
import { searchArtists, type ArtistSearchResult } from '@/db/actions/artist-search'

const SEARCH_DEBOUNCE_MS = 300
const MIN_QUERY_LENGTH = 2
const AVATAR_SIZE = 40

function describeUpcoming(count: number): string {
  if (count === 0) return 'No upcoming festivals on Goodraves'
  return `${count} upcoming ${count === 1 ? 'festival' : 'festivals'}`
}

function SearchResultRow({ result }: { result: ArtistSearchResult }) {
  const href = `/artist/${result.artistId}/${encodeURIComponent(result.name)}`
  return (
    <div className="artist-search-result">
      <Link href={href} style={{ flexShrink: 0 }} aria-label={result.name}>
        {result.imageUrl ? (
          <Image src={result.imageUrl} alt={result.name} width={AVATAR_SIZE} height={AVATAR_SIZE} sizes={`${AVATAR_SIZE}px`} style={{ borderRadius: '50%', objectFit: 'cover' }} />
        ) : (
          <div className="followed-artist-placeholder" style={{ width: AVATAR_SIZE, height: AVATAR_SIZE, fontSize: '1rem' }}>🎤</div>
        )}
      </Link>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Link href={href} style={{ fontWeight: 700, color: 'inherit', textDecoration: 'none' }}>{result.name}</Link>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{describeUpcoming(result.upcomingCount)}</div>
      </div>
      <FollowButton artistId={result.artistId} artistName={result.name} isCompactOnMobile />
    </div>
  )
}

/** Find any artist on Goodraves and follow them, not only ones you've seen. */
export default function FollowingArtistSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ArtistSearchResult[]>([])
  const [searchedFor, setSearchedFor] = useState('')
  const [error, setError] = useState<string | null>(null)
  const trimmed = query.trim()
  const isActive = trimmed.length >= MIN_QUERY_LENGTH

  useEffect(() => {
    if (trimmed.length < MIN_QUERY_LENGTH) return
    let isCancelled = false
    const timer = setTimeout(() => {
      searchArtists(trimmed)
        .then((rows) => {
          if (isCancelled) return
          setResults(rows)
          setSearchedFor(trimmed)
          setError(null)
        })
        .catch((err) => {
          // Server errors can carry raw SQL; log them, show a plain message.
          console.error('[FollowingArtistSearch] Search failed:', err)
          if (!isCancelled) setError('Search failed, try again in a moment.')
        })
    }, SEARCH_DEBOUNCE_MS)
    return () => { isCancelled = true; clearTimeout(timer) }
  }, [trimmed])

  const hasCurrentResults = isActive && searchedFor === trimmed

  return (
    <div style={{ marginBottom: 32, maxWidth: 560 }}>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search for an artist to follow"
        aria-label="Search for an artist to follow"
        autoComplete="off"
        className="artist-search-input"
      />
      {isActive && error && <p style={{ color: 'var(--error-text)', fontSize: '0.85rem', marginTop: 8 }}>{error}</p>}
      {hasCurrentResults && !error && results.length === 0 && (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 8 }}>No artists named like &ldquo;{trimmed}&rdquo; on Goodraves yet.</p>
      )}
      {isActive && results.length > 0 && (
        <div className="artist-search-results">
          {results.map((result) => (
            <SearchResultRow key={result.artistId} result={result} />
          ))}
        </div>
      )}
    </div>
  )
}
