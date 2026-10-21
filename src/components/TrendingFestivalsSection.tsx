'use client'

import Link from 'next/link'
import { type TrendingFestival } from '@/db/actions/trending-festivals'
import { formatDate } from '@/lib/format-date'
import styles from './TrendingFestivalsSection.module.css'

const RANK_DIGITS = 2

function describeStats(festival: TrendingFestival): string {
  return [
    festival.interestedCount > 0 ? `${festival.interestedCount.toLocaleString()} interested` : null,
    festival.visitorsCount > 0 ? `${festival.visitorsCount.toLocaleString()} going` : null,
  ].filter(Boolean).join(' · ')
}

function describePlace(festival: TrendingFestival): string {
  return [
    festival.location,
    festival.distanceKm !== null ? `${Math.round(festival.distanceKm)} km` : null,
  ].filter(Boolean).join(' · ')
}

type Props = {
  festivals: TrendingFestival[]
  userCity: string | null
}

/** Numbered list of popular upcoming festivals, nearest the user's city when known. Board: MyFestivals (aside). */
export default function TrendingFestivalsSection({ festivals, userCity }: Props) {
  return (
    <section>
      <div className={styles.header}>
        <h2 className={`display ${styles.title}`}>{userCity ? `Trending near ${userCity}` : 'Trending'}</h2>
      </div>
      <ol className={styles.list}>
        {festivals.map((festival, index) => {
          const stats = describeStats(festival)
          return (
            <li key={festival.id}>
              <Link href={`/festival/${festival.id}`} className={styles.row}>
                <span className={`mono ${styles.rank}`}>{String(index + 1).padStart(RANK_DIGITS, '0')}</span>
                <span className={styles.info}>
                  <span className={styles.name}>{festival.name}</span>
                  <span className={styles.place}>{[formatDate(festival.date), describePlace(festival)].filter(Boolean).join(' · ')}</span>
                  {stats && <span className={`mono ${styles.stats}`}>{stats}</span>}
                </span>
              </Link>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
