'use client'

import Link from 'next/link'
import type { TimetableStage } from '@/db/actions/festivals'
import { toDayRange } from '@/lib/timetable-time'
import {
  formatMinutesToTime,
  calculateTimeRange,
  generateHourMarkers,
  toPercent,
  groupSlotsByTime,
  type SlotGroup,
} from './timetable-utils'
import styles from './Timetable.module.css'

const LABEL_WIDTH_PX = 140
// Minimum track width, so blocks don't become unreadably narrow. Long days
// get HOUR_WIDTH_PX per hour instead, so hour labels never collide.
const MIN_TRACK_WIDTH_PX = 860
const HOUR_WIDTH_PX = 96
const MINUTES_PER_HOUR = 60

type Highlights = {
  pickedArtistIds: Set<string>
  clashArtistIds: Set<string>
}

type Props = Highlights & {
  stages: TimetableStage[]
}

type Range = { rangeStart: number; rangeEnd: number }

function TimeAxis({ hourMarkers, rangeStart, rangeEnd }: Range & { hourMarkers: number[] }) {
  return (
    <div className={styles.axis}>
      {hourMarkers.map((marker, index) => {
        // First label aligns left and last label right, so neither bleeds
        // past the track edge and widens the scroll container.
        const alignClass = index === 0 ? styles.axisFirst : index === hourMarkers.length - 1 ? styles.axisLast : ''
        return (
          <span
            key={marker}
            className={`mono ${styles.axisLabel} ${alignClass}`}
            style={{ left: `${toPercent(marker, rangeStart, rangeEnd)}%` }}
          >
            {formatMinutesToTime(marker)}
          </span>
        )
      })}
    </div>
  )
}

function getBlockClass(group: SlotGroup, { pickedArtistIds, clashArtistIds }: Highlights): string {
  if (group.artists.some((a) => clashArtistIds.has(a.artistId))) return styles.blockClash
  if (group.artists.some((a) => pickedArtistIds.has(a.artistId))) return styles.blockPicked
  return ''
}

function ArtistBlock({ group, dayStart, rangeStart, rangeEnd, highlights }: Range & {
  group: SlotGroup
  dayStart: number
  highlights: Highlights
}) {
  const [start, end] = toDayRange(group, dayStart)
  const leftPct = toPercent(start, rangeStart, rangeEnd)
  const widthPct = toPercent(end, rangeStart, rangeEnd) - leftPct
  const timeLabel = `${group.startTime}–${group.endTime}`
  const isB2b = group.artists.length > 1

  return (
    <div
      className={`${styles.block} ${getBlockClass(group, highlights)}`}
      title={`${group.artists.map(a => a.artistName).join(' & ')}\n${timeLabel}`}
      style={{ left: `${leftPct}%`, width: `calc(${widthPct}% - 4px)` }}
    >
      {/* Each artist is its own link, so middle-click works for B2B partners too. */}
      <span className={styles.blockNames}>
        {isB2b && <span className={styles.b2bTag}>B2B</span>}
        {group.artists.map((artist, index) => (
          <span key={artist.artistId}>
            <Link href={`/artist/${artist.artistId}/${encodeURIComponent(artist.artistName)}`} className={styles.blockLink}>
              {artist.artistName}
            </Link>
            {index < group.artists.length - 1 && ' & '}
          </span>
        ))}
      </span>
      <span className={`mono ${styles.blockTime}`}>{timeLabel}</span>
    </div>
  )
}

function StageRow({ stage, dayStart, rangeStart, rangeEnd, hourMarkers, highlights }: Range & {
  stage: TimetableStage
  dayStart: number
  hourMarkers: number[]
  highlights: Highlights
}) {
  const slotGroups = groupSlotsByTime(stage.slots)

  return (
    <div className={styles.stageRow}>
      {/* Stays at the left edge while the track scrolls. */}
      <div className={styles.stageLabel}>
        <span className={`mono ${styles.stageName}`}>{stage.stageName}</span>
        <span className={`mono ${styles.stageCount}`}>{slotGroups.length} sets</span>
      </div>
      <div className={styles.track}>
        {/* The last marker sits at left: 100%; a 1px line there would overflow. */}
        {hourMarkers.slice(0, -1).map(marker => (
          <div key={marker} className={styles.gridLine} style={{ left: `${toPercent(marker, rangeStart, rangeEnd)}%` }} />
        ))}
        {slotGroups.map(group => (
          <ArtistBlock
            key={`${group.startTime}-${group.slotOrder}`}
            group={group}
            dayStart={dayStart}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            highlights={highlights}
          />
        ))}
      </div>
    </div>
  )
}

/** Stages as rows, time across. Board: Festival (timetable). */
export default function TimetableGantt({ stages, pickedArtistIds, clashArtistIds }: Props) {
  const { dayStart, startMinutes, endMinutes } = calculateTimeRange(stages)
  const hourMarkers = generateHourMarkers(startMinutes, endMinutes)
  const highlights = { pickedArtistIds, clashArtistIds }
  const trackWidth = Math.max(MIN_TRACK_WIDTH_PX, ((endMinutes - startMinutes) / MINUTES_PER_HOUR) * HOUR_WIDTH_PX)

  return (
    <div className={styles.ganttScroll}>
      <div className={styles.gantt} style={{ gridTemplateColumns: `${LABEL_WIDTH_PX}px 1fr`, minWidth: LABEL_WIDTH_PX + trackWidth }}>
        <div className={styles.axisCorner} />
        <TimeAxis hourMarkers={hourMarkers} rangeStart={startMinutes} rangeEnd={endMinutes} />
        {stages.map(stage => (
          <StageRow
            key={stage.stageOrder}
            stage={stage}
            dayStart={dayStart}
            rangeStart={startMinutes}
            rangeEnd={endMinutes}
            hourMarkers={hourMarkers}
            highlights={highlights}
          />
        ))}
      </div>
    </div>
  )
}
