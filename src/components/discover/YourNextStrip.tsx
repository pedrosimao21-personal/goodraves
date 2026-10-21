'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useUserData } from '@/context/UserDataContext'
import { useMyFestivals } from '@/app/dashboard/_components/use-my-festivals'
import { ArrowRightIcon } from '@/components/icons'
import { formatDateRange } from '@/lib/format-date'
import styles from './DiscoverHome.module.css'

const THUMB_SIZE = 128
const MONOGRAM_WORDS = 2

function describeWhen(daysUntil: number): string {
  if (daysUntil <= 0) return 'Your next · on now'
  if (daysUntil === 1) return 'Your next · tomorrow'
  return `Your next · in ${daysUntil} days`
}

/** The user's next festival, one tap from Discover. Board: DiscoverMobile. */
export default function YourNextStrip() {
  const { getFestivalMeta, wantToSee } = useUserData()
  const { nextUpcomingId, daysUntilNext } = useMyFestivals()
  if (!nextUpcomingId || daysUntilNext === null) return null

  const meta = getFestivalMeta(nextUpcomingId)
  if (!meta) return null
  const image = meta.image || meta.imageUrl
  const picks = wantToSee[nextUpcomingId]?.length ?? 0
  const detail = picks > 0 ? `${picks} pick${picks === 1 ? '' : 's'}` : formatDateRange(meta.date, meta.endDate)
  const monogram = (meta.name ?? '').split(/\s+/).slice(0, MONOGRAM_WORDS).map((word: string) => word[0]).join('')

  return (
    <Link href={`/festival/${nextUpcomingId}`} className={styles.next}>
      <span className={styles.nextThumb} aria-hidden="true">
        {image
          ? <Image src={image} alt="" width={THUMB_SIZE} height={THUMB_SIZE} sizes="64px" />
          : <span className={`display ${styles.monogram}`}>{monogram}</span>}
      </span>
      <span className={styles.nextInfo}>
        <span className={`mono ${styles.nextWhen}`}>{describeWhen(daysUntilNext)}</span>
        <span className={`display ${styles.nextName}`}>{meta.name ?? nextUpcomingId}</span>
        <span className={`mono ${styles.nextDetail}`}>{detail}</span>
      </span>
      <ArrowRightIcon size={18} strokeWidth={2} />
    </Link>
  )
}
