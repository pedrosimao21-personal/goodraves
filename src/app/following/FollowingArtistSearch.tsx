'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import FollowButton from '@/components/FollowButton'
import { SearchIcon } from '@/components/icons'
import { searchArtists, type ArtistSearchResult } from '@/db/actions/artist-search'
import styles from './FollowingSearch.module.css'

const SEARCH_DEBOUNCE_MS = 300
const MIN_QUERY_LENGTH = 2
const AVATAR_SIZE = 88

function describeUpcoming(count: number): string {
  if (count === 0) return 'No upcoming festivals'
  return `${count} upcoming ${count === 1 ? 'festival' : 'festivals'}`
}

function SearchResultRow({ result }: { result: ArtistSearchResult }) {
  const href = `/artist/${result.artistId}/${encodeURIComponent(result.name)}`
  return (
    <div className={styles.result}>
      <Link href={href} className={styles.avatar} aria-label={result.name}>
        {result.imageUrl
          ? <Image src={result.imageUrl} alt="" width={AVATAR_SIZE} height={AVATAR_SIZE} sizes="44px" />
          : <span className="display" aria-hidden="true">{result.name[0]}</span>}
      </Link>
      <div className={styles.resultInfo}>
        <Link href={href} className={styles.resultName}>{result.name}</Link>
        <span className={`mono ${styles.resultMeta}`}>{describeUpcoming(result.upcomingCount)}</span>
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
    <div className={styles.search}>
      <div className={styles.field} role="search">
        <SearchIcon size={20} className={styles.icon} />
        <label htmlFor="following-artist-search" className="sr-only">Search for an artist to follow</label>
        <input
          id="following-artist-search"
          type="search"
          className={styles.input}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for an artist to follow"
          autoComplete="off"
        />
      </div>
      {isActive && (error || hasCurrentResults || results.length > 0) && (
        <div className={styles.dropdown}>
          {error && <p className="form-error">{error}</p>}
          {hasCurrentResults && !error && results.length === 0 && (
            <p className={styles.noResults}>No artists named like &ldquo;{trimmed}&rdquo; on Goodraves yet.</p>
          )}
          {results.map((result) => <SearchResultRow key={result.artistId} result={result} />)}
        </div>
      )}
    </div>
  )
}
