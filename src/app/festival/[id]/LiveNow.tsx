'use client'

import { formatClock, minutesBetween, setNames, type LiveSet } from './live-state'
import styles from './LiveMode.module.css'

const PERCENT = 100

function NowCard({ set, now }: { set: LiveSet; now: Date }) {
  const total = set.end.getTime() - set.start.getTime()
  const progress = total > 0 ? Math.round(((now.getTime() - set.start.getTime()) / total) * PERCENT) : 0
  return (
    <div className={styles.nowCard}>
      <h2 className={`display ${styles.nowName}`}>{setNames(set)}</h2>
      <div className={`mono ${styles.nowTimes}`}>
        <span>{set.group.startTime}–{set.group.endTime}</span>
        <span>{minutesBetween(now, set.end)} min left</span>
      </div>
      <div className={styles.progress} role="progressbar" aria-label="Set progress" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={PERCENT}>
        <div className={styles.progressFill} style={{ width: `${progress}%` }} />
      </div>
    </div>
  )
}

/** Without a pick playing: what every stage has on right now. */
function OnNowList({ sets }: { sets: LiveSet[] }) {
  if (sets.length === 0) return <p className={styles.quiet}>Nothing is playing right now.</p>
  return (
    <div className={styles.rows}>
      {sets.map((set) => (
        <div key={`${set.stageName}-${set.group.startTime}`} className={styles.row}>
          <span className={styles.rowMain}>
            <span className={styles.rowName}>{setNames(set)}</span>
            <span className={`mono ${styles.rowMeta}`}>{set.stageName} · until {formatClock(set.end)}</span>
          </span>
        </div>
      ))}
    </div>
  )
}

/** Your pick playing now with how long is left, or every stage's current set. Board: FestivalLiveMobile. */
export default function LiveNow({ nowPicks, onNow, now }: { nowPicks: LiveSet[]; onNow: LiveSet[]; now: Date }) {
  const current = nowPicks[0]
  if (!current) {
    return (
      <div>
        <p className={`mono ${styles.label}`}>On now</p>
        <OnNowList sets={onNow} />
      </div>
    )
  }
  return (
    <div>
      <p className={`mono ${styles.label}`}>Now · {current.stageName}</p>
      <NowCard set={current} now={now} />
      {nowPicks.length > 1 && (
        <p className={`mono ${styles.clashNote}`}>Also picked now: {nowPicks.slice(1).map((set) => `${setNames(set)} (${set.stageName})`).join(', ')}</p>
      )}
    </div>
  )
}
