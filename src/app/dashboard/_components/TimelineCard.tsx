'use client'

import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import RatingMeter from '@/components/rating/RatingMeter'
import { formatDate } from '@/lib/format-date'
import styles from './Timeline.module.css'

const THUMB_SIZE = 112
const MONOGRAM_WORDS = 2

interface TimelineArtist {
  id: string
  name: string
  image: string | null
  rating: number
}

interface TimelineFestivalMeta {
  name?: string
  date?: string
  image?: string
  imageUrl?: string
  genres?: string[]
  venue?: { name?: string; city?: string } | string
}

interface TimelineCardProps {
  festivalId: string
  meta: TimelineFestivalMeta
  seenArtists: TimelineArtist[]
  isUpcoming: boolean
}

const ArtistChip = React.memo(({ artist }: { artist: TimelineArtist }) => (
  <Link href={`/artist/${artist.id}/${encodeURIComponent(artist.name)}`} className={styles.artist}>
    <span className={styles.artistName}>{artist.name}</span>
    {artist.rating > 0 && <RatingMeter value={artist.rating} size="sm" />}
  </Link>
))

ArtistChip.displayName = 'ArtistChip'

function buildVenueLabel(venue: TimelineFestivalMeta['venue']): string | null {
  if (!venue) return null
  if (typeof venue === 'string') return venue
  return [venue.name, venue.city].filter(Boolean).join(', ') || null
}

/** One festival on the timeline, with the artists you saw there. */
const TimelineCard = React.memo(({ festivalId, meta, seenArtists, isUpcoming }: TimelineCardProps) => {
  const image = meta.image || meta.imageUrl
  const name = meta.name ?? festivalId
  const details = [meta.date ? formatDate(meta.date, 'timeline') : null, buildVenueLabel(meta.venue)].filter(Boolean).join(' · ')
  const href = `/festival/${festivalId}`

  return (
    <article className={styles.card}>
      <div className={styles.cardHeader}>
        <Link href={href} className={styles.thumb} tabIndex={-1} aria-hidden="true">
          {image
            ? <Image src={image} alt="" width={THUMB_SIZE} height={THUMB_SIZE} sizes="56px" />
            : <span className={`display ${styles.monogram}`}>{name.split(/\s+/).slice(0, MONOGRAM_WORDS).map(w => w[0]).join('')}</span>}
        </Link>
        <div className={styles.cardInfo}>
          <Link href={href} className={`display ${styles.cardName}`}>{name}</Link>
          {details && <span className={`mono ${styles.cardDetails}`}>{details}</span>}
        </div>
        <div className={styles.tags}>
          {meta.genres?.map((genre) => <span key={genre} className="tag">{genre}</span>)}
          {isUpcoming && <span className={`tag ${styles.goingTag}`}>Going</span>}
        </div>
      </div>

      {seenArtists.length > 0 && (
        <div className={styles.seen}>
          <p className={`mono ${styles.seenLabel}`}>Artists seen · {seenArtists.length}</p>
          <div className={styles.artists}>
            {seenArtists.map(artist => <ArtistChip key={artist.id} artist={artist} />)}
          </div>
        </div>
      )}
    </article>
  )
})

TimelineCard.displayName = 'TimelineCard'

export default TimelineCard
