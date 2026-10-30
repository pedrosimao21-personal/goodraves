'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useUserDataActions } from '@/context/UserDataContext'
import RatingSquares from '@/components/rating/RatingSquares'
import RemoveFestivalSheet from '@/components/RemoveFestivalSheet'
import { CloseIcon, EditIcon } from '@/components/icons'
import { parseLocalDate } from '@/lib/dates'
import styles from './FestivalRow.module.css'

const THUMB_SIZE = 112
const MONOGRAM_WORDS = 2
const DAY_DIGITS = 2

function formatShortDate(isoDate: string): string {
  const date = parseLocalDate(isoDate)
  return `${String(date.getDate()).padStart(DAY_DIGITS, '0')} ${date.toLocaleString('en-US', { month: 'short' })}`
}

function DateBadge({ isoDate }: { isoDate: string }) {
  const date = parseLocalDate(isoDate)
  return (
    <span className={styles.dateBadge}>
      <span className="mono">{date.toLocaleString('en-US', { month: 'short' })}</span>
      <span className={`display ${styles.dateDay}`}>{String(date.getDate()).padStart(DAY_DIGITS, '0')}</span>
    </span>
  )
}

const FestivalRow = React.memo(({ eventId, onRemove, isUpcomingTab, onEdit }: {
  eventId: string
  onRemove: (id: string) => Promise<unknown>
  isUpcomingTab: boolean
  onEdit?: (id: string) => void
}) => {
  const { getSeenCount, getFestivalMeta, getFestivalRating } = useUserDataActions()

  const meta = getFestivalMeta(eventId)
  const seenCount = getSeenCount(eventId)
  const vibe = getFestivalRating(eventId)
  const name = meta?.name ?? eventId
  const image = meta?.image || meta?.imageUrl
  const venue = meta?.venue && typeof meta.venue === 'object' ? meta.venue : null
  const place = [venue?.name, venue?.city].filter(Boolean).join(' · ')
  const href = `/festival/${eventId}`

  const [isConfirming, setIsConfirming] = useState(false)

  return (
    <div className={`${styles.row} ${isUpcomingTab ? styles.upcoming : ''}`}>
      {isUpcomingTab
        ? (meta?.date ? <DateBadge isoDate={meta.date} /> : <span />)
        : <span className={`mono ${styles.date}`}>{meta?.date ? formatShortDate(meta.date) : ''}</span>}

      <Link href={href} className={styles.thumb} tabIndex={-1} aria-hidden="true">
        {image
          ? <Image src={image} alt="" width={THUMB_SIZE} height={THUMB_SIZE} sizes="56px" />
          : <span className={`display ${styles.monogram}`}>{name.split(/\s+/).slice(0, MONOGRAM_WORDS).map((w: string) => w[0]).join('')}</span>}
      </Link>

      <div className={styles.info}>
        <Link href={href} className={styles.name}>{name}</Link>
        {place && <span className={styles.place}>{place}</span>}
      </div>

      {!isUpcomingTab && (
        <span className={`mono ${styles.seen}`}>
          {seenCount > 0 && <><span className={styles.seenCount}>{seenCount}</span> seen</>}
        </span>
      )}
      {!isUpcomingTab && (
        <span className={styles.vibe}>{vibe > 0 && <RatingSquares value={vibe} size="sm" />}</span>
      )}

      <div className={styles.actions}>
        {onEdit && (
          <button type="button" className={styles.iconButton} onClick={() => onEdit(eventId)} aria-label={`Edit ${name}`} title="Edit festival details">
            <EditIcon size={16} />
          </button>
        )}
        <button type="button" className={styles.iconButton} onClick={() => setIsConfirming(true)} id={`remove-${eventId}`} aria-label={`Remove ${name}`} title="Remove from list">
          <CloseIcon size={16} />
        </button>
      </div>

      {isConfirming && (
        <RemoveFestivalSheet eventId={eventId} name={name} onConfirm={() => onRemove(eventId)} onClose={() => setIsConfirming(false)} />
      )}
    </div>
  )
})

FestivalRow.displayName = 'FestivalRow'

export default FestivalRow
