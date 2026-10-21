'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import type { ArtistUpcomingFestival } from '@/db/actions/artist-follow-context'
import type { RAUpcomingEvent } from '@/services/ra/client'
import { parseLocalDate } from '@/lib/dates'
import { formatGigSet } from '@/lib/following-display'
import { ExternalIcon } from '@/components/icons'
import SectionHeading from './SectionHeading'
import styles from './ArtistBody.module.css'

const COLLAPSED_FESTIVAL_COUNT = 5
const DAY_DIGITS = 2

function DateBadge({ date }: { date: Date }) {
  return (
    <span className={styles.dateBadge} aria-hidden="true">
      <span className="mono">{date.toLocaleString('en-US', { month: 'short' })}</span>
      <span className={`display ${styles.dateDay}`}>{String(date.getDate()).padStart(DAY_DIGITS, '0')}</span>
    </span>
  )
}

function UpcomingRow({ date, name, place, detail, source }: {
  date: Date
  name: string
  place: string
  detail?: ReactNode
  source: string
}) {
  return (
    <>
      <DateBadge date={date} />
      <span className={styles.upcomingInfo}>
        <span className={styles.upcomingName}>{name}</span>
        {place && <span className={styles.upcomingPlace}>{place}</span>}
        {detail}
        <span className={`mono ${styles.upcomingSource}`}>{source}</span>
      </span>
    </>
  )
}

/** This artist on festivals in our own lineups, with their set times when known. */
export function GoodravesUpcoming({ festivals }: { festivals: ArtistUpcomingFestival[] }) {
  const [isExpanded, setIsExpanded] = useState(false)
  if (festivals.length === 0) return null
  const visible = isExpanded ? festivals : festivals.slice(0, COLLAPSED_FESTIVAL_COUNT)

  return (
    <section>
      <SectionHeading title="Upcoming" meta={String(festivals.length)} />
      {visible.map((festival) => {
        const isMultiDay = Boolean(festival.endDate && festival.endDate !== festival.date)
        const sets = festival.sets.map((set, i) => (
          <span key={i} className={`mono ${styles.upcomingSet}`}>{formatGigSet(set, isMultiDay)}</span>
        ))
        return (
          <Link key={festival.festivalId} href={`/festival/${festival.festivalId}`} className={styles.upcomingRow}>
            <UpcomingRow
              date={parseLocalDate(festival.date)}
              name={festival.name}
              place={[festival.venue, festival.location].filter(Boolean).join(' · ')}
              detail={sets}
              source="Goodraves"
            />
          </Link>
        )
      })}
      {festivals.length > COLLAPSED_FESTIVAL_COUNT && (
        <button type="button" className={`mono ${styles.textButton}`} onClick={() => setIsExpanded(!isExpanded)}>
          {isExpanded ? 'Show fewer' : `Show all ${festivals.length}`}
        </button>
      )}
    </section>
  )
}

/** Upcoming shows Resident Advisor lists for this artist. */
export function RaUpcoming({ artistName, raArtistId, events }: {
  artistName: string
  raArtistId: string | null
  events: RAUpcomingEvent[]
}) {
  const raSearchUrl = `https://ra.co/search?q=${encodeURIComponent(artistName)}`
  const raArtistUrl = raArtistId ? `https://ra.co/dj/${raArtistId}` : raSearchUrl

  return (
    <section>
      <SectionHeading title="On Resident Advisor" meta={events.length > 0 ? String(events.length) : undefined} />
      {events.length === 0 ? (
        <p className={styles.muted}>
          No shows found yet.{' '}
          <a href={raSearchUrl} target="_blank" rel="noreferrer" className={styles.inlineLink}>Search Resident Advisor</a>
        </p>
      ) : (
        events.map((event) => (
          <a key={event.id} href={event.raUrl} target="_blank" rel="noreferrer" className={styles.upcomingRow}>
            <UpcomingRow
              date={new Date(event.date)}
              name={event.title}
              place={[event.venue, event.city].filter(Boolean).join(' · ')}
              source="Resident Advisor"
            />
          </a>
        ))
      )}
      {events.length > 0 && (
        <a href={raArtistUrl} target="_blank" rel="noreferrer" className={`mono ${styles.textButton}`}>
          View all on Resident Advisor<ExternalIcon size={14} strokeWidth={2} />
        </a>
      )}
    </section>
  )
}
