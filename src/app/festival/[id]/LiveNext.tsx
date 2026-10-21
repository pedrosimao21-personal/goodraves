'use client'

import { useState } from 'react'
import type { SlotGroup } from './timetable-utils'
import { formatClock, minutesBetween, setNames, type LiveSet } from './live-state'
import styles from './LiveMode.module.css'

type Props = {
  next: LiveSet
  /** The pick playing now, if any, to tell whether the next one is on the same stage. */
  current: LiveSet | null
  clashes: LiveSet[]
  now: Date
  onTogglePick: (group: SlotGroup) => void
}

function describeWhere(next: LiveSet, current: LiveSet | null): string {
  if (current && current.stageName === next.stageName) return 'Same stage, stay where you are.'
  return `On ${next.stageName}.`
}

/**
 * The next pick and, when it overlaps another pick, the choice: keep one (the
 * other is unpicked) or split your time (both stay picked; the choice is only
 * hidden for this visit). Board: FestivalLiveMobile.
 */
export default function LiveNext({ next, current, clashes, now, onTogglePick }: Props) {
  const [isSplit, setIsSplit] = useState(false)
  const clash = !isSplit ? clashes[0] : undefined

  return (
    <div>
      <p className={`mono ${styles.label}`}>Next pick · in {minutesBetween(now, next.start)} min</p>
      <div className={`${styles.nextCard} ${clash ? styles.nextClash : ''}`}>
        <div className={styles.nextTop}>
          <span className={`display ${styles.nextName}`}>{setNames(next)}</span>
          <span className="mono">{next.group.startTime}</span>
        </div>
        <p className={styles.nextWhere}>
          {describeWhere(next, current)}
          {clash && (
            <span className={styles.warn}> Clashes with {setNames(clash)} at {formatClock(clash.start)} on {clash.stageName}.</span>
          )}
        </p>
        {clash && (
          <div className={styles.choices}>
            <button type="button" className="btn" onClick={() => onTogglePick(clash.group)}>Keep {next.group.artists[0].artistName}</button>
            <button type="button" className="btn" onClick={() => onTogglePick(next.group)}>Keep {clash.group.artists[0].artistName}</button>
            <button type="button" className="btn" onClick={() => setIsSplit(true)}>Split</button>
          </div>
        )}
      </div>
    </div>
  )
}
