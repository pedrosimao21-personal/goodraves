'use client'

import { useState } from 'react'
import Link from 'next/link'
import { parseLocalDate } from '@/lib/dates'
import { formatDateRange } from '@/lib/format-date'
import { formatGigSet } from '@/lib/following-display'
import { ExternalIcon } from '@/components/icons'
import SectionHeading from './SectionHeading'
import type { UpcomingShow } from './upcoming-merge'
import styles from './ArtistBody.module.css'

const COLLAPSED_SHOW_COUNT = 5
const DAY_DIGITS = 2

function DateBadge({ isoDate }: { isoDate: string }) {
  const date = parseLocalDate(isoDate)
  return (
    <span className={styles.dateBadge} aria-hidden="true">
      <span className="mono">{date.toLocaleString('en-US', { month: 'short' })}</span>
      <span className={`display ${styles.dateDay}`}>{String(date.getDate()).padStart(DAY_DIGITS, '0')}</span>
    </span>
  )
}

function ShowRow({ show }: { show: UpcomingShow }) {
  const isMultiDay = Boolean(show.endDate && show.endDate !== show.date)
  return (
    <Link href={`/festival/${show.festivalId}`} className={styles.upcomingRow}>
      <DateBadge isoDate={show.date} />
      <span className={styles.upcomingInfo}>
        <span className={styles.upcomingName}>{show.name}</span>
        <span className="sr-only">{formatDateRange(show.date, show.endDate)}</span>
        {show.place && <span className={styles.upcomingPlace}>{show.place}</span>}
        {show.sets.map((set, i) => (
          <span key={i} className={`mono ${styles.upcomingSet}`}>{formatGigSet(set, isMultiDay)}</span>
        ))}
        <span className={`mono ${styles.upcomingSource}`}>{show.source}</span>
      </span>
    </Link>
  )
}

type Props = {
  shows: UpcomingShow[]
  artistName: string
  raArtistId: string | null
}

/**
 * Where the artist plays next: our lineups and their Resident Advisor shows in
 * one list, each show once, with its source. Board: Artist ("Upcoming").
 */
export default function ArtistUpcoming({ shows, artistName, raArtistId }: Props) {
  const [isExpanded, setIsExpanded] = useState(false)
  const visible = isExpanded ? shows : shows.slice(0, COLLAPSED_SHOW_COUNT)
  const raUrl = raArtistId ? `https://ra.co/dj/${raArtistId}` : `https://ra.co/search?q=${encodeURIComponent(artistName)}`

  return (
    <section>
      <SectionHeading title="Upcoming" meta={shows.length > 0 ? String(shows.length) : undefined} />
      {shows.length === 0 && <p className={styles.muted}>No upcoming shows found.</p>}
      {visible.map((show) => <ShowRow key={show.festivalId} show={show} />)}
      <div className={styles.upcomingFooter}>
        {shows.length > COLLAPSED_SHOW_COUNT && (
          <button type="button" className={`mono ${styles.textButton}`} onClick={() => setIsExpanded(!isExpanded)}>
            {isExpanded ? 'Show fewer' : `Show all ${shows.length}`}
          </button>
        )}
        <a href={raUrl} target="_blank" rel="noreferrer" className={`mono ${styles.textButton}`}>
          {raArtistId ? 'View all on Resident Advisor' : 'Search Resident Advisor'}<ExternalIcon size={14} strokeWidth={2} />
        </a>
      </div>
    </section>
  )
}
