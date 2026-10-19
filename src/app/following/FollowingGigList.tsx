'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { FollowingGig } from '@/db/actions/following-gig-builder'
import FollowingGigCard from './FollowingGigCard'
import { groupGigsByMonth, isGigNearCity } from '@/lib/following-display'

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          {visibleGigs.length} upcoming {visibleGigs.length === 1 ? 'festival' : 'festivals'}
        </span>
        {userCity ? (
          <div className="following-filter" role="group" aria-label="Filter by location">
            <button className={!isNearOnly ? 'is-active' : ''} onClick={() => setIsNearOnly(false)} aria-pressed={!isNearOnly}>All</button>
            <button className={isNearOnly ? 'is-active' : ''} onClick={() => setIsNearOnly(true)} aria-pressed={isNearOnly}>
              Near {userCity} ({nearIds.size})
            </button>
          </div>
        ) : (
          <Link href="/profile" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Set your city to see gigs near you
          </Link>
        )}
      </div>

      {months.length === 0 && (
        <p style={{ color: 'var(--text-muted)' }}>
          {isNearOnly ? `No upcoming gigs near ${userCity} yet.` : 'None of the artists you follow have an upcoming festival on Goodraves yet.'}
        </p>
      )}

      {months.map((month) => (
        <section key={month.monthKey} style={{ marginBottom: 24 }}>
          <h3 className="following-month">{month.label}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {month.gigs.map((gig) => (
              <FollowingGigCard key={gig.festivalId} gig={gig} isNear={nearIds.has(gig.festivalId)} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
