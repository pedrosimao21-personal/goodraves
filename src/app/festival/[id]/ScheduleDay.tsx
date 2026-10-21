'use client'

import Link from 'next/link'
import { WarningIcon } from '@/components/icons'
import { parseLocalDate } from '@/lib/dates'
import type { MinuteRange } from '@/lib/timetable-time'
import type { ScheduleDay as ScheduleDayData, ScheduleSet } from './schedule-builder'
import { formatMinutesToTime, type SlotGroup } from './timetable-utils'
import { formatDayTabLabel } from './DayTabs'
import PickButton from './PickButton'
import styles from './Schedule.module.css'

const MINUTES_PER_HOUR = 60

type RowActions = { onTogglePick?: (group: SlotGroup) => void }

function formatRange([start, end]: MinuteRange): string {
  return `${formatMinutesToTime(start)}–${formatMinutesToTime(end)}`
}

/** "1 h", "45 min", "1 h 30". */
function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / MINUTES_PER_HOUR)
  const rest = minutes % MINUTES_PER_HOUR
  if (hours === 0) return `${rest} min`
  return rest === 0 ? `${hours} h` : `${hours} h ${rest}`
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

function SetRow({ set, isClash = false, onTogglePick }: RowActions & { set: ScheduleSet; isClash?: boolean }) {
  const names = set.artists.map((artist) => artist.artistName).join(' & ')
  return (
    <div className={`${styles.row} ${isClash ? styles.rowClash : ''}`}>
      <span className={`mono ${styles.time}`}>
        {formatMinutesToTime(set.range[0])}<span className={styles.timeSep}>–</span>
        <span className={styles.timeEnd}>{formatMinutesToTime(set.range[1])}</span>
      </span>
      <span className={styles.names}>
        {set.artists.length > 1 && <span className={styles.b2bTag}>B2B</span>}
        {set.artists.map((artist, index) => (
          <span key={artist.artistId}>
            <Link href={`/artist/${artist.artistId}/${encodeURIComponent(artist.artistName)}`} className={styles.link}>
              {artist.artistName}
            </Link>
            {index < set.artists.length - 1 && ' & '}
          </span>
        ))}
      </span>
      <span className={`mono ${styles.stage}`}>{set.stageName}</span>
      {onTogglePick && <PickButton className={styles.pick} isPicked isClash={isClash} name={names} onToggle={() => onTogglePick(set)} />}
    </div>
  )
}

function ClashGroup({ sets, overlap, onTogglePick }: RowActions & { sets: ScheduleSet[]; overlap: MinuteRange }) {
  return (
    <div className={styles.clash} role="group" aria-label="Clash">
      <div className={styles.clashTitle}>
        <WarningIcon size={16} />
        <span className="mono">
          Clash · {formatRange(overlap)} overlap<span className={styles.clashHint}> · keep one or split your time</span>
        </span>
      </div>
      {sets.map((set) => (
        <SetRow key={`${set.stageName}-${set.range[0]}`} set={set} isClash onTogglePick={onTogglePick} />
      ))}
    </div>
  )
}

/** One day of Your schedule: picks in time order, free time, clashes. Board: Festival / FestivalMobile. */
export default function ScheduleDay({ day, onTogglePick }: RowActions & { day: ScheduleDayData }) {
  const label = formatDayTabLabel(day.day)
  const weekday = parseLocalDate(day.day).toLocaleDateString('en-US', { weekday: 'long' })

  if (day.pickCount === 0) {
    return (
      <div className={styles.day}>
        <h3 className={`mono ${styles.dayTitle} ${styles.dayTitleEmpty}`}>{label} · no picks</h3>
        <p className={styles.dayEmpty}>Pick sets in the timetable for {weekday}.</p>
      </div>
    )
  }

  return (
    <div className={styles.day}>
      <h3 className={`mono ${styles.dayTitle}`}>{label} · {plural(day.pickCount, 'pick')}</h3>
      <div className={styles.rows}>
        {day.items.map((item) => {
          if (item.kind === 'free') {
            return <p key={`free-${item.range[0]}`} className={`mono ${styles.free}`}>{formatRange(item.range)} · {formatDuration(item.range[1] - item.range[0])} free</p>
          }
          if (item.kind === 'clash') {
            return <ClashGroup key={`clash-${item.overlap[0]}`} sets={item.sets} overlap={item.overlap} onTogglePick={onTogglePick} />
          }
          return <SetRow key={`${item.set.stageName}-${item.set.range[0]}`} set={item.set} onTogglePick={onTogglePick} />
        })}
      </div>
    </div>
  )
}
