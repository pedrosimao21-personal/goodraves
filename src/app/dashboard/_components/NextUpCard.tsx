'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useUserData } from '@/context/UserDataContext'
import AttendToggle from '@/components/AttendToggle'
import { formatDateRange } from '@/lib/format-date'
import styles from './NextUpCard.module.css'

const THUMB_SIZE = 240
const MONOGRAM_WORDS = 2

function describeWhen(daysUntilNext: number): string {
  if (daysUntilNext <= 0) return 'On now'
  if (daysUntilNext === 1) return 'Next up · tomorrow'
  return `Next up · in ${daysUntilNext} days`
}

/** The closest upcoming festival, with a shortcut to its timetable. Board: MyFestivals. */
export default function NextUpCard({ festivalId, daysUntilNext }: { festivalId: string; daysUntilNext: number }) {
  const { getFestivalMeta, wantToSee, toggleFestival } = useUserData()
  const meta = getFestivalMeta(festivalId)
  if (!meta) return null

  const image = meta.image || meta.imageUrl
  const venue = typeof meta.venue === 'object' ? meta.venue : null
  const place = [venue?.name, venue?.city ?? meta.location].filter(Boolean).join(', ')
  const picks = wantToSee[festivalId]?.length ?? 0
  const monogram = (meta.name ?? '').split(/\s+/).slice(0, MONOGRAM_WORDS).map((w: string) => w[0]).join('')
  const href = `/festival/${festivalId}`

  return (
    <article className={styles.nextUp}>
      <Link href={href} className={styles.nextThumb} tabIndex={-1} aria-hidden="true">
        {image
          ? <Image src={image} alt="" width={THUMB_SIZE} height={THUMB_SIZE} sizes="120px" />
          : <span className={`display ${styles.thumbMonogram}`}>{monogram}</span>}
      </Link>
      <div className={styles.nextInfo}>
        <span className={`mono ${styles.nextWhen}`}>{describeWhen(daysUntilNext)}</span>
        <Link href={href} className={`display ${styles.nextName}`}>{meta.name ?? festivalId}</Link>
        <span className={styles.nextPlace}>{[formatDateRange(meta.date, meta.endDate), place].filter(Boolean).join(' · ')}</span>
        {picks > 0 && <span className={`mono ${styles.nextPicks}`}>{picks} pick{picks === 1 ? '' : 's'}</span>}
      </div>
      <div className={styles.nextActions}>
        <Link href={`${href}#timetable`} className="btn">Timetable</Link>
        <AttendToggle isFuture isActive onToggle={() => toggleFestival(festivalId)} />
      </div>
    </article>
  )
}
