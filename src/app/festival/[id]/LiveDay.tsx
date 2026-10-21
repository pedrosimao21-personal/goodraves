'use client'

import { Fragment } from 'react'
import { useUserData } from '@/context/UserDataContext'
import RatingInput from '@/components/rating/RatingInput'
import { parseLocalDate } from '@/lib/dates'
import { findClashingPicks, formatClock, setNames, type LiveSet } from './live-state'
import styles from './LiveMode.module.css'

/** Picks that just ended, rated in one tap (which marks them as seen). Board: FestivalLiveMobile. */
export function LiveRate({ festivalId, sets }: { festivalId: string; sets: LiveSet[] }) {
  const { getPerformanceRating, setPerformanceRating } = useUserData()
  if (sets.length === 0) return null

  return (
    <div>
      <p className={`mono ${styles.label}`}>Just finished · rate it</p>
      <div className={styles.rows}>
        {sets.map((set) => {
          const name = setNames(set)
          const rating = getPerformanceRating(festivalId, set.group.artists[0].artistId)
          return (
            <div key={`${set.stageName}-${set.group.startTime}`} className={styles.row}>
              <span className={styles.rowMain}>
                <span className={styles.rowName}>{name}</span>
                <span className={`mono ${styles.rowMeta}`}>{set.stageName} · {set.group.startTime}–{set.group.endTime}</span>
              </span>
              <RatingInput
                value={rating}
                label={`Rate ${name}`}
                onChange={(next) => set.group.artists.forEach((artist) => setPerformanceRating(festivalId, artist.artistId, next))}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function rowState(set: LiveSet, now: Date, dayPicks: LiveSet[]): 'past' | 'now' | 'clash' | 'later' {
  if (set.end <= now) return 'past'
  if (set.start <= now) return 'now'
  return findClashingPicks(set, dayPicks).length > 0 ? 'clash' : 'later'
}

const ROW_CLASS = { past: styles.dayRowPast, now: styles.dayRowNow, clash: styles.dayRowClash, later: '' }

/** The day's picks with a line at the current time. Board: FestivalLiveMobile ("Your Saturday"). */
export function LiveDaySchedule({ day, dayPicks, now }: { day: string; dayPicks: LiveSet[]; now: Date }) {
  const weekday = parseLocalDate(day).toLocaleDateString('en-US', { weekday: 'long' })
  const lineBefore = dayPicks.findIndex((set) => set.start > now)

  return (
    <section>
      <div className={styles.dayHeading}>
        <h2 className={`display ${styles.dayTitle}`}>Your {weekday}</h2>
        <span className={`mono ${styles.rowMeta}`}>{dayPicks.length} pick{dayPicks.length === 1 ? '' : 's'}</span>
      </div>
      {dayPicks.length === 0 && <p className={styles.quiet}>No picks for today. Pick sets in the timetable to plan your day.</p>}
      {dayPicks.map((set, index) => {
        const state = rowState(set, now, dayPicks)
        const tag = { past: set.stageName, now: 'Now', clash: 'Clash', later: set.stageName }[state]
        return (
          <Fragment key={`${set.stageName}-${set.group.startTime}`}>
            {index === lineBefore && (
              <div className={styles.nowLine} aria-hidden="true">
                <span className="mono">{formatClock(now)}</span><span className={styles.nowLineBar} />
              </div>
            )}
            <div className={`${styles.dayRow} ${ROW_CLASS[state]}`}>
              <span className={`mono ${styles.dayTime}`}>{set.group.startTime}<br />{set.group.endTime}</span>
              <span className={styles.rowName}>{setNames(set)}</span>
              <span className={`mono ${styles.dayTag}`}>{tag}</span>
            </div>
          </Fragment>
        )
      })}
    </section>
  )
}
