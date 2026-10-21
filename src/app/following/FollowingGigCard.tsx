'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useUserDataActions } from '@/context/UserDataContext'
import type { FollowingGig, GigArtist } from '@/db/actions/following-gig-builder'
import AttendToggle from '@/components/AttendToggle'
import { PinIcon } from '@/components/icons'
import { parseLocalDate } from '@/lib/dates'
import { formatDateRange } from '@/lib/format-date'
import { formatGigSet, formatNameList } from '@/lib/following-display'
import styles from './FollowingGigCard.module.css'

const GIG_IMAGE_SIZE = 192
const DAY_DIGITS = 2
const MONOGRAM_WORDS = 2

function DateBadge({ isoDate }: { isoDate: string }) {
  const date = parseLocalDate(isoDate)
  return (
    <span className={styles.dateBadge} aria-hidden="true">
      <span className="mono">{date.toLocaleDateString('en-US', { weekday: 'short' })}</span>
      <span className={`display ${styles.dateDay}`}>{String(date.getDate()).padStart(DAY_DIGITS, '0')}</span>
    </span>
  )
}

function GigArtistLine({ artist, isMultiDay }: { artist: GigArtist; isMultiDay: boolean }) {
  const href = `/artist/${artist.artistId}/${encodeURIComponent(artist.name)}`
  return (
    <span className={styles.act}>
      <Link href={href} className={styles.actName}>{artist.name}</Link>
      {artist.sets.map((set, i) => (
        <span key={i} className={`mono ${styles.actSet}`}>{formatGigSet(set, isMultiDay)}</span>
      ))}
    </span>
  )
}

function GoingToggle({ gig }: { gig: FollowingGig }) {
  const { isUpcoming, toggleFestival } = useUserDataActions()

  const handleClick = () => {
    // Same payload shape as FestivalCard, so the optimistic update files the
    // festival under "upcoming" (it reads the date from this meta).
    toggleFestival(gig.festivalId, {
      name: gig.name,
      date: gig.date,
      endDate: gig.endDate,
      venue: gig.venue,
      location: gig.location,
      image: gig.imageUrl,
      source: gig.source,
    })
  }

  return <AttendToggle size="sm" isFuture isActive={isUpcoming(gig.festivalId)} onToggle={handleClick} compactOnMobile />
}

/** One festival where artists you follow play. Board: Following. */
export default function FollowingGigCard({ gig, isNear }: { gig: FollowingGig; isNear: boolean }) {
  const isMultiDay = Boolean(gig.endDate && gig.endDate !== gig.date)
  const place = [gig.venue, gig.location].filter(Boolean).join(', ')
  const href = `/festival/${gig.festivalId}`
  const monogram = gig.name.split(/\s+/).slice(0, MONOGRAM_WORDS).map((word) => word[0]).join('')

  return (
    <article className={styles.card}>
      <DateBadge isoDate={gig.date} />
      <Link href={href} className={styles.thumb} tabIndex={-1} aria-hidden="true">
        {gig.imageUrl
          ? <Image src={gig.imageUrl} alt="" width={GIG_IMAGE_SIZE} height={GIG_IMAGE_SIZE} sizes="96px" />
          : <span className={`display ${styles.monogram}`}>{monogram}</span>}
      </Link>

      <div className={styles.info}>
        <div className={styles.titleRow}>
          <Link href={href} className={`display ${styles.name}`}>{gig.name}</Link>
          {isNear && <span className="tag"><PinIcon size={11} strokeWidth={2.2} />Near you</span>}
        </div>
        <span className={styles.place}>{[isMultiDay ? formatDateRange(gig.date, gig.endDate) : null, place].filter(Boolean).join(' · ')}</span>
        <div className={styles.acts}>
          {gig.artists.map((artist) => <GigArtistLine key={artist.artistId} artist={artist} isMultiDay={isMultiDay} />)}
        </div>
        {gig.clashes.map((clash, i) => (
          <span key={i} className={`mono ${styles.clash}`}>Clash · {clash.artistA} and {clash.artistB} overlap</span>
        ))}
        {gig.friendsGoing.length > 0 && (
          <span className={`mono ${styles.friends}`}>
            {formatNameList(gig.friendsGoing)} {gig.friendsGoing.length === 1 ? 'is' : 'are'} going
          </span>
        )}
      </div>

      <div>
        <GoingToggle gig={gig} />
      </div>
    </article>
  )
}
