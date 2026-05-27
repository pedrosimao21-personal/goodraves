'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { getPopularArtists, type PopularArtist } from '@/db/actions/popular-artists'

function buildArtistHref(artist: PopularArtist): string {
  const slugName = artist.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  return `/artist/${artist.id}/${slugName}`
}

function ArtistChip({ artist }: { artist: PopularArtist }) {
  return (
    <Link href={buildArtistHref(artist)} className="dj-suggestion-chip">
      {artist.imageUrl && (
        <Image
          src={artist.imageUrl}
          alt={artist.name}
          width={20}
          height={20}
          sizes="20px"
          className="dj-suggestion-chip-img"
        />
      )}
      {artist.name}
    </Link>
  )
}

export default function DjSuggestionsChips() {
  const [popularArtists, setPopularArtists] = useState<PopularArtist[]>([])

  useEffect(() => {
    getPopularArtists(12)
      .then(setPopularArtists)
      .catch(() => setPopularArtists([]))
  }, [])

  if (popularArtists.length === 0) return null

  return (
    <div className="dj-suggestions-section">
      <div className="dj-suggestions-label">Popular DJs &amp; Artists</div>
      <div className="dj-suggestions-chips">
        {popularArtists.map((artist) => (
          <ArtistChip key={artist.id} artist={artist} />
        ))}
      </div>
    </div>
  )
}
