'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getPopularArtists, type PopularArtist } from '@/db/actions/popular-artists'
import styles from './TopDjs.module.css'

const POPULAR_ARTIST_COUNT = 12

function buildArtistHref(artist: PopularArtist): string {
  const slugName = artist.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  return `/artist/${artist.id}/${slugName}`
}

/** Popular artists to explore while your own ranking is empty. */
export default function DjSuggestionsChips() {
  const [popularArtists, setPopularArtists] = useState<PopularArtist[]>([])

  useEffect(() => {
    getPopularArtists(POPULAR_ARTIST_COUNT)
      .then(setPopularArtists)
      .catch(() => setPopularArtists([]))
  }, [])

  if (popularArtists.length === 0) return null

  return (
    <div className={styles.suggestions}>
      <p className={`mono ${styles.sheetLabel}`}>Popular on Goodraves</p>
      <div className={styles.chips}>
        {popularArtists.map((artist) => (
          <Link key={artist.id} href={buildArtistHref(artist)} className="chip">{artist.name}</Link>
        ))}
      </div>
    </div>
  )
}
