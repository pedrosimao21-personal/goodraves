'use client'

import { useMemo } from 'react'
import type { TimetableData } from '@/db/actions/festivals'
import { formatDayTabLabel } from './DayTabs'
import { buildLiveSets, buildLiveState, findClashingPicks, findLiveDay, formatClock } from './live-state'
import { useNowMinute } from './use-now-minute'
import { usePicks } from './use-picks'
import LiveNow from './LiveNow'
import LiveNext from './LiveNext'
import { LiveDaySchedule, LiveRate } from './LiveDay'
import styles from './LiveMode.module.css'

/** How many just-finished sets to offer for rating at once. */
const RATE_LIMIT = 2

/**
 * The phone view while a festival you're going to is running: what's on now,
 * your next pick, rating what just ended, and your day with a now-line. Times
 * are the device's local time (slot times carry no zone). Only shows during a
 * timetable day; CSS keeps it to phones. Board: FestivalLiveMobile.
 */
export default function LiveMode({ festivalId, timetable }: { festivalId: string; timetable: TimetableData }) {
  const now = useNowMinute()
  const { pickedArtistIds, togglePick } = usePicks(festivalId)
  const liveDay = useMemo(() => (now ? findLiveDay(timetable, now) : null), [timetable, now])
  const sets = useMemo(() => (liveDay ? buildLiveSets(timetable, liveDay) : []), [timetable, liveDay])

  if (!now || !liveDay) return null

  const state = buildLiveState(sets, pickedArtistIds, now)
  const current = state.nowPicks[0] ?? null
  const dayNumber = timetable.days.indexOf(liveDay) + 1
  const dayLabel = timetable.days.length > 1
    ? `Day ${dayNumber} of ${timetable.days.length} · ${formatDayTabLabel(liveDay)}`
    : formatDayTabLabel(liveDay)

  return (
    <section className={styles.live} aria-label="Live">
      <div className={styles.liveTop}>
        <span className={`mono ${styles.dayLabel}`}>{dayLabel}</span>
        <span className={`mono ${styles.liveChip}`}><span className={styles.liveDot} aria-hidden="true" />Live {formatClock(now)}</span>
      </div>

      <LiveNow nowPicks={state.nowPicks} onNow={state.onNow} now={now} />
      {state.nextPick && (
        <LiveNext
          key={`${state.nextPick.stageName}-${state.nextPick.group.startTime}`}
          next={state.nextPick}
          current={current}
          clashes={findClashingPicks(state.nextPick, state.dayPicks)}
          now={now}
          onTogglePick={togglePick}
        />
      )}
      <LiveRate festivalId={festivalId} sets={state.justFinished.slice(0, RATE_LIMIT)} />
      <LiveDaySchedule day={liveDay} dayPicks={state.dayPicks} now={now} />

      <div className={styles.links}>
        <a href="#timetable" className="btn">Full timetable</a>
        <a href="#festival-info" className="btn">Festival info</a>
      </div>
    </section>
  )
}
