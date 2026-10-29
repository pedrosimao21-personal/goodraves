'use client'

import { useState, useEffect, memo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useUserDataActions } from '../context/UserDataContext'
import { getFestivalCardImage } from '@/db/actions/festivals'
import { formatDateRange } from '@/lib/format-date'
import { isFestivalPast } from '@/lib/festival-date'
import AttendToggle from './AttendToggle'
import FriendsGoing from './FriendsGoing'
import styles from './FestivalCard.module.css'

const CARD_IMAGE_SIZE = 400
const MONOGRAM_LETTERS = 2

function SourceBadge({ source }: { source?: string }) {
  if (source === 'ra') {
    return (
      <span className={styles.badge}>
        <Image className={styles.raLogo} src="/ra-logo.svg" alt="Resident Advisor" width={20} height={10} unoptimized />
      </span>
    )
  }
  if (source === 'festivalfans') {
    return (
      <span className={styles.badge}>
        <Image src="/festivalfans-icon.png" alt="FestivalFans" width={14} height={14} unoptimized />
      </span>
    )
  }
  if (source === 'partyflock') {
    return (
      <span className={styles.badge}>
        <Image src="/partyflock-icon.png" alt="Partyflock" width={14} height={14} unoptimized />
      </span>
    )
  }
  return <span className={styles.badge}>{source ?? 'Custom'}</span>
}

/** First letters of the first words, e.g. "Kade Weekender" → "KW". */
function monogram(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, MONOGRAM_LETTERS)
    .map((word) => word[0])
    .join('')
}

type FestivalCardProps = {
  event: any
  /**
   * Set by render sites that already resolve images for every card themselves
   * (SearchSection runs its own enrichment pass over the whole result set).
   * Without it, each card fires a second, redundant lookup for the same image,
   * multiplying the request count by the number of imageless results.
   */
  skipImageFetch?: boolean
  /** Usernames of the viewer's friends going (Discover). */
  friendsGoing?: string[]
  /** Mute the card when the festival is over, so past results read as history next to upcoming ones. */
  shouldMutePast?: boolean
}

export default memo(function FestivalCard({ event, skipImageFetch = false, friendsGoing, shouldMutePast = false }: FestivalCardProps) {
  const { isAttended, isUpcoming, toggleFestival, getSeenCount } = useUserDataActions()

  const attended = isAttended(event.id)
  const upcoming = isUpcoming(event.id)
  const seenCount = getSeenCount(event.id)
  const artistCount = event.attractions?.length ?? 0

  // endDate-aware: a multi-day festival still counts as upcoming/ongoing on
  // its later days, not just its first.
  const isFuture = event.date && !isFestivalPast(event.date, event.endDate)

  // Spotify image fallback for events without images
  const [fallbackImage, setFallbackImage] = useState<string | null>(null)

  useEffect(() => {
    if (skipImageFetch) return
    if (event.image) return

    const mainArtist = artistCount > 0 ? event.attractions[0].name : null
    const venueName = event.venue?.name ?? null
    const city = event.venue?.city ?? null
    // Nothing to look an image up from — don't fire the RPC (which also does a
    // rate-limit DB write) for a card with no artist, venue, or city.
    if (!mainArtist && !venueName && !city) return

    let cancelled = false

    // Single gated action: tries the main artist's Spotify image, then a
    // Wikipedia thumbnail for the venue, then the city (server-side).
    getFestivalCardImage({ mainArtist, venueName, city })
      .then((img) => { if (!cancelled && img) setFallbackImage(img) })
      .catch(() => { /* fallback image unavailable */ })

    return () => { cancelled = true }
  }, [skipImageFetch, event.image, artistCount, event.attractions, event.venue?.name, event.venue?.city])

  const displayImage = event.image || fallbackImage

  const handleToggle = () => {
    toggleFestival(event.id, {
      name: event.name,
      date: event.date,
      endDate: event.endDate ?? null,
      venue: event.venue,
      location: event.location ?? null,
      latitude: event.latitude ?? null,
      longitude: event.longitude ?? null,
      image: displayImage,
      source: event.source,
    })
  }

  const festivalHref = `/festival/${event.id}`
  const isExternal = event._fromRA || event._fromFF || event._fromPF
  const place = [event.venue?.name, event.venue?.city].filter(Boolean).join(' · ')

  return (
    <article className={`${styles.card} ${shouldMutePast && !isFuture ? styles.cardPast : ''} fade-in`}>
      <Link href={festivalHref} className={styles.media} aria-label={event.name} tabIndex={-1}>
        {displayImage ? (
          <Image
            className={styles.image}
            src={displayImage}
            alt=""
            width={CARD_IMAGE_SIZE}
            height={CARD_IMAGE_SIZE}
            sizes="(max-width: 640px) 80px, 400px"
            quality={85}
          />
        ) : (
          <span className={`display ${styles.monogram}`} aria-hidden="true">{monogram(event.name ?? '')}</span>
        )}
        {(isExternal || !isFuture) && (
          <span className={styles.badges}>
            {isExternal && <SourceBadge source={event.source} />}
            {!isFuture && <span className={styles.badge}>Past</span>}
          </span>
        )}
      </Link>

      <div className={styles.body}>
        <span className="mono">{formatDateRange(event.date, event.endDate)}</span>
        <h3 className={`display ${styles.title}`}>
          <Link href={festivalHref}>{event.name}</Link>
        </h3>
        {place && <span className={styles.place}>{place}</span>}
        {friendsGoing && <FriendsGoing friends={friendsGoing} />}
        {event.genres?.length > 0 && (
          <div className={styles.tags}>
            {event.genres.map((genre: string) => (
              <span key={genre} className="tag">{genre}</span>
            ))}
          </div>
        )}
      </div>

      <div className={styles.footer}>
        <span className={`mono ${styles.meta}`}>
          {attended && seenCount > 0
            ? `${seenCount} seen`
            : artistCount > 0 ? `${artistCount} artist${artistCount !== 1 ? 's' : ''}` : ''}
        </span>
        <AttendToggle
          id={`action-${event.id}`}
          size="sm"
          isFuture={Boolean(isFuture)}
          isActive={attended || upcoming}
          onToggle={handleToggle}
          compactOnMobile
        />
      </div>
    </article>
  )
})
