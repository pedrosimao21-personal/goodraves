'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { FollowingGig } from '@/db/actions/following-gig-builder'
import { groupGigsByMonth, isGigNearCity } from '@/lib/following-display'
import FollowingGigCard from './FollowingGigCard'
import styles from './Following.module.css'

/** Upcoming gigs of followed artists by month, with an All / Near {city} toggle. */
export default function FollowingGigList({ gigs, userCity }: { gigs: FollowingGig[]; userCity: string | null }) {
  const [isNearOnly, setIsNearOnly] = useState(false)

  const nearIds = useMemo(
    () => new Set(gigs.filter((gig) => isGigNearCity(gig, userCity)).map((gig) => gig.festivalId)),
    [gigs, userCity]
  )
  const visibleGigs = isNearOnly ? gigs.filter((gig) => nearIds.has(gig.festivalId)) : gigs
  const months = groupGigsByMonth(visibleGigs)

  return (
    <div>
      <div className={styles.sectionHeader}>
        <h2 className={`display ${styles.sectionTitle}`}>
          Upcoming gigs <span className={styles.count}>{visibleGigs.length}</span>
        </h2>
        {userCity ? (
          <div className={styles.seg} role="group" aria-label="Filter gigs by location">
            <button type="button" className={!isNearOnly ? styles.segOn : undefined} onClick={() => setIsNearOnly(false)} aria-pressed={!isNearOnly}>
              All · {gigs.length}
            </button>
            <button type="button" className={isNearOnly ? styles.segOn : undefined} onClick={() => setIsNearOnly(true)} aria-pressed={isNearOnly}>
              Near {userCity} · {nearIds.size}
            </button>
          </div>
        ) : (
          <Link href="/profile" className={`mono ${styles.textLink}`}>Set your city to see gigs near you</Link>
        )}
      </div>

      {months.length === 0 && (
        <p className={styles.muted}>
          {isNearOnly ? `No upcoming gigs near ${userCity} yet.` : 'None of the artists you follow have an upcoming festival on Goodraves yet.'}
        </p>
      )}

      {months.map((month) => (
        <section key={month.monthKey}>
          <h3 className={`mono ${styles.month}`}>{month.label}</h3>
          {month.gigs.map((gig) => (
            <FollowingGigCard key={gig.festivalId} gig={gig} isNear={nearIds.has(gig.festivalId)} />
          ))}
        </section>
      ))}
    </div>
  )
}
