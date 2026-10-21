'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import AttendToggle from '@/components/AttendToggle'
import AttendedStatus from './AttendedStatus'
import ShareFestivalButton from '@/components/ShareFestivalButton'
import AddToCalendarButton from '@/components/AddToCalendarButton'
import { ArrowLeftIcon, DotsIcon, ExternalIcon } from '@/components/icons'
import { formatDateRange } from '@/lib/format-date'
import type { FestivalPhase } from '@/lib/festival-date'
import { type FestivalEvent, countFestivalDays, getSourceLink, toMonogram } from './festival-event'
import styles from './FestivalHeader.module.css'

const FLYER_WIDTH = 800
const FLYER_HEIGHT = 1000
/** Names longer than this step down a display size. */
const LONG_TITLE_LENGTH = 22

interface FestivalHeaderProps {
  id: string
  event: FestivalEvent
  phase: FestivalPhase
  isActive: boolean
  attended: boolean
  seenCount: number
  onToggleAttendance: () => void
  /** Takes the festival off the user's list (behind a confirm). */
  onRemoveAttendance: () => Promise<unknown>
  /** Opens the admin sheet; omitted for non-admins and custom festivals. */
  onOpenAdmin?: () => void
}

function formatCrowd(event: FestivalEvent): string | null {
  const parts = [
    event.interestedCount > 0 ? `${event.interestedCount.toLocaleString()} interested` : null,
    event.visitorsCount > 0 ? `${event.visitorsCount.toLocaleString()} going` : null,
  ].filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : null
}

/** Board: Festival (desktop) and FestivalMobile. */
export default function FestivalHeader({
  id, event, phase, isActive, attended, seenCount, onToggleAttendance, onRemoveAttendance, onOpenAdmin,
}: FestivalHeaderProps) {
  const router = useRouter()
  const source = getSourceLink(id)
  const dates = formatDateRange(event.date, event.endDate, 'long')
  const venue = [event.venue?.name, event.venue?.city, event.venue?.country].filter(Boolean).join(', ')
  const crowd = formatCrowd(event)
  const dayCount = countFestivalDays(event.date, event.endDate)
  const artistCount = event.attractions?.length ?? 0
  const isPast = phase === 'past'

  return (
    <section id="festival-info" className={styles.header}>
      <div className={styles.topRow}>
        <button type="button" className={`mono ${styles.back}`} onClick={() => router.back()} id="back-btn">
          <ArrowLeftIcon size={16} strokeWidth={2} />Back
        </button>
        {onOpenAdmin && (
          <button type="button" className="btn-icon" onClick={onOpenAdmin} aria-label="Admin options" title="Admin options">
            <DotsIcon size={20} />
          </button>
        )}
      </div>

      <div className={styles.layout}>
        <figure className={styles.flyer}>
          {event.imageUrl ? (
            <Image
              className={styles.flyerImage}
              src={event.imageUrl}
              alt={`${event.name} flyer`}
              width={FLYER_WIDTH}
              height={FLYER_HEIGHT}
              sizes="(max-width: 640px) 96px, 400px"
              quality={85}
              priority
            />
          ) : (
            <span className={styles.flyerEmpty} aria-hidden="true">
              <span className={`display ${styles.monogram}`}>{toMonogram(event.name ?? '')}</span>
            </span>
          )}
          {source && <figcaption className={`mono ${styles.caption}`}>Source · {source.name}</figcaption>}
        </figure>

        <div className={styles.chips}>
          {event.genres?.map((genre: string) => <span key={genre} className="tag">{genre}</span>)}
          {dayCount > 1 && <span className="tag">{dayCount} days</span>}
          {phase === 'ongoing' && <span className="tag">On now</span>}
          {isPast && <span className="tag">Past</span>}
        </div>

        <h1 className={`display ${styles.title} ${event.name?.length > LONG_TITLE_LENGTH ? styles.titleLong : ''}`}>{event.name}</h1>

        <dl className={styles.facts}>
          <div className={styles.fact}><dt className="mono">Dates</dt><dd className={styles.date}>{dates}</dd></div>
          {venue && <div className={styles.fact}><dt className="mono">Venue</dt><dd>{venue}</dd></div>}
          {crowd && <div className={styles.fact}><dt className="mono">Crowd</dt><dd className="mono">{crowd}</dd></div>}
        </dl>

        <div className={styles.actions}>
          {attended ? (
            <AttendedStatus
              eventId={id}
              name={event.name}
              seenCount={seenCount}
              artistCount={artistCount}
              onRemove={onRemoveAttendance}
            />
          ) : (
            <AttendToggle id="detail-attend-btn" size="lg" isFuture={!isPast} isActive={isActive} onToggle={onToggleAttendance} />
          )}
          {!isPast && (
            <AddToCalendarButton
              className={styles.actionButton}
              labelClassName={styles.hideOnMobile}
              festival={{ id, name: event.name, date: event.date, endDate: event.endDate, venueName: event.venue?.name, location: event.venue?.city }}
            />
          )}
          <ShareFestivalButton className={styles.iconAction} name={event.name} date={dates} venue={event.venue?.name} />
          {source && (
            <a href={source.url} target="_blank" rel="noreferrer" className={`mono ${styles.sourceLink}`} aria-label={`View on ${source.name}`}>
              <span className={styles.hideOnMobile}>{source.name}</span>
              <ExternalIcon size={14} strokeWidth={2} />
            </a>
          )}
        </div>

      </div>
    </section>
  )
}
