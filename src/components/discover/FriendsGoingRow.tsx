'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { getFriendsUpcomingFestivals } from '@/db/actions/friends-going'
import type { FriendsFestival } from '@/db/actions/friends-going-core'
import FriendsGoing from '@/components/FriendsGoing'
import { formatDateRange } from '@/lib/format-date'
import styles from './DiscoverHome.module.css'

const CARD_IMAGE_SIZE = 336
const MONOGRAM_WORDS = 2

function FriendsFestivalCard({ festival }: { festival: FriendsFestival }) {
  const monogram = festival.name.split(/\s+/).slice(0, MONOGRAM_WORDS).map((word) => word[0]).join('')
  return (
    <Link href={`/festival/${festival.festivalId}`} className={styles.friendCard}>
      <span className={styles.friendImage} aria-hidden="true">
        {festival.imageUrl
          ? <Image src={festival.imageUrl} alt="" width={CARD_IMAGE_SIZE} height={CARD_IMAGE_SIZE} sizes="168px" />
          : <span className={`display ${styles.monogram}`}>{monogram}</span>}
      </span>
      <span className="mono">{formatDateRange(festival.date, festival.endDate)}</span>
      <span className={`display ${styles.friendName}`}>{festival.name}</span>
      <FriendsGoing friends={festival.friends} />
    </Link>
  )
}

/** Upcoming festivals the user's friends are going to, in a horizontal row. Board: DiscoverMobile. */
export default function FriendsGoingRow() {
  const { status } = useSession()
  const [festivals, setFestivals] = useState<FriendsFestival[]>([])

  useEffect(() => {
    if (status !== 'authenticated') return
    let isCancelled = false
    getFriendsUpcomingFestivals()
      .then((next) => { if (!isCancelled) setFestivals(next) })
      .catch((err) => {
        // The row stays hidden; search works without it.
        console.error('[discover] Failed to load friends going:', err)
        if (!isCancelled) setFestivals([])
      })
    return () => { isCancelled = true }
  }, [status])

  if (festivals.length === 0) return null

  return (
    <section aria-labelledby="friends-going-title">
      <div className={styles.rowHeading}>
        <h2 id="friends-going-title" className={`display ${styles.rowTitle}`}>Friends are going</h2>
        <span className={`mono ${styles.rowCount}`}>{festivals.length}</span>
      </div>
      <div className={styles.scroller}>
        {festivals.map((festival) => <FriendsFestivalCard key={festival.festivalId} festival={festival} />)}
      </div>
    </section>
  )
}
