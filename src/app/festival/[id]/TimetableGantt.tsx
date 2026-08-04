'use client'

import Link from 'next/link'
import type { TimetableStage } from '@/db/actions/festivals'
import {
  parseTimeToMinutes,
  formatMinutesToTime,
  calculateTimeRange,
  generateHourMarkers,
  toPercent,
  groupSlotsByTime,
  type SlotGroup,
} from './timetable-utils'

// ── Layout constants ────────────────────────────────────────────────────────

const LABEL_WIDTH_PX = 120
// Minimum track width for mobile — prevents blocks becoming unreadably narrow.
const MIN_TRACK_WIDTH_PX = 400
const ROW_HEIGHT_PX = 72
const BLOCK_VERTICAL_PAD_PX = 6
const TIME_AXIS_HEIGHT_PX = 32

// ── Local types ─────────────────────────────────────────────────────────────

type Props = {
  stages: TimetableStage[]
}

// ── Sub-components ───────────────────────────────────────────────────────────

type TimeAxisProps = {
  hourMarkers: number[]
  rangeStart: number
  rangeEnd: number
}

function TimeAxis({ hourMarkers, rangeStart, rangeEnd }: TimeAxisProps) {
  return (
    <div
      style={{
        position: 'relative',
        height: TIME_AXIS_HEIGHT_PX,
        borderBottom: '1px solid var(--border)',
      }}
    >
      {hourMarkers.map((marker, index) => {
        const isFirst = index === 0
        const isLast = index === hourMarkers.length - 1
        // Align first label left and last label right so neither bleeds
        // past the track boundary and triggers a scroll container overflow.
        const transform = isFirst
          ? 'none'
          : isLast
            ? 'translateX(-100%)'
            : 'translateX(-50%)'
        return (
          <div
            key={marker}
            style={{
              position: 'absolute',
              left: `${toPercent(marker, rangeStart, rangeEnd)}%`,
              top: 0,
              transform,
              height: '100%',
            }}
          >
            <span
              style={{
                fontSize: '0.7rem',
                color: 'var(--text-muted)',
                fontWeight: 500,
                lineHeight: `${TIME_AXIS_HEIGHT_PX}px`,
                whiteSpace: 'nowrap',
                display: 'block',
              }}
            >
              {formatMinutesToTime(marker)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

type ArtistBlockProps = {
  group: SlotGroup
  rangeStart: number
  rangeEnd: number
}

function ArtistBlock({ group, rangeStart, rangeEnd }: ArtistBlockProps) {
  const startMinutes = parseTimeToMinutes(group.startTime)
  const endMinutes = parseTimeToMinutes(group.endTime)
  const leftPct = toPercent(startMinutes, rangeStart, rangeEnd)
  const widthPct = toPercent(endMinutes, rangeStart, rangeEnd) - leftPct
  const timeLabel = `${group.startTime} – ${group.endTime}`
  const tooltipNames = group.artists.map(a => a.artistName).join(' b2b ')

  return (
    <div
      title={`${tooltipNames}\n${timeLabel}`}
      style={{
        position: 'absolute',
        left: `${leftPct}%`,
        width: `${widthPct}%`,
        top: BLOCK_VERTICAL_PAD_PX,
        bottom: BLOCK_VERTICAL_PAD_PX,
        background: 'var(--accent-purple-glow-12)',
        borderRadius: '0 4px 4px 0',
        borderLeftStyle: 'solid',
        borderLeftWidth: 2,
        borderLeftColor: 'var(--accent-purple)',
        padding: '3px 8px',
        textAlign: 'left',
        overflow: 'hidden',
        transition: 'background 120ms',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 1,
      }}
    >
      {/* Artist name(s) — each is its own link so middle-click / right-click works
          for every artist, including B2B partners. */}
      <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0 4px' }}>
        {group.artists.map((artist, index) => (
          <span key={artist.artistId} style={{ display: 'contents' }}>
            <Link
              href={`/artist/${artist.artistId}/${encodeURIComponent(artist.artistName)}`}
              style={{
                fontSize: '0.72rem',
                fontWeight: 500,
                color: 'var(--text-primary)',
                whiteSpace: 'nowrap',
                textDecoration: 'none',
              }}
              onMouseEnter={e => { e.currentTarget.style.textDecoration = 'underline' }}
              onMouseLeave={e => { e.currentTarget.style.textDecoration = 'none' }}
            >
              {artist.artistName}
            </Link>
            {index < group.artists.length - 1 && (
              <span
                style={{
                  fontSize: '0.58rem',
                  fontWeight: 400,
                  color: 'var(--text-muted)',
                  flexShrink: 0,
                  letterSpacing: '0.03em',
                }}
              >
                b2b
              </span>
            )}
          </span>
        ))}
      </span>

      {/* Time range */}
      <span
        style={{
          fontSize: '0.62rem',
          color: 'var(--text-muted)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {timeLabel}
      </span>
    </div>
  )
}

type StageRowProps = {
  stage: TimetableStage
  rangeStart: number
  rangeEnd: number
  hourMarkers: number[]
  isEven: boolean
}

function StageRow({ stage, rangeStart, rangeEnd, hourMarkers, isEven }: StageRowProps) {
  const slotGroups = groupSlotsByTime(stage.slots)

  return (
    <div style={{ display: 'contents' }}>
      {/* Stage label — sticks to the left while track scrolls */}
      <div
        style={{
          position: 'sticky',
          left: 0,
          zIndex: 2,
          display: 'flex',
          alignItems: 'center',
          height: ROW_HEIGHT_PX,
          paddingRight: 12,
          background: isEven
            ? 'var(--bg-primary)'
            : 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <span
          style={{
            fontSize: '0.68rem',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: LABEL_WIDTH_PX - 16,
          }}
        >
          {stage.stageName}
        </span>
      </div>

      {/* Track — contains artist blocks and hour grid lines */}
      <div
        style={{
          position: 'relative',
          height: ROW_HEIGHT_PX,
          background: isEven
            ? 'var(--bg-primary)'
            : 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        {/* Vertical hour grid lines — skip the last marker (it sits at
            left: 100% and a 1px div there overflows the container) */}
        {hourMarkers.slice(0, -1).map(marker => (
          <div
            key={marker}
            style={{
              position: 'absolute',
              left: `${toPercent(marker, rangeStart, rangeEnd)}%`,
              top: 0,
              bottom: 0,
              width: 1,
              background: 'var(--border)',
              pointerEvents: 'none',
            }}
          />
        ))}

        {/* Artist blocks */}
        {slotGroups.map(group => (
          <ArtistBlock
            key={`${group.startTime}-${group.slotOrder}`}
            group={group}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
          />
        ))}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TimetableGantt({ stages }: Props) {
  const { startMinutes, endMinutes } = calculateTimeRange(stages)
  const hourMarkers = generateHourMarkers(startMinutes, endMinutes)

  return (
    <div style={{ overflowX: 'auto', overflowY: 'visible' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `${LABEL_WIDTH_PX}px 1fr`,
          minWidth: LABEL_WIDTH_PX + MIN_TRACK_WIDTH_PX,
        }}
      >
        {/* Time axis header row */}
        <div
          style={{
            position: 'sticky',
            left: 0,
            zIndex: 3,
            height: TIME_AXIS_HEIGHT_PX,
            background: 'var(--bg-primary)',
            borderBottom: '1px solid var(--border)',
          }}
        />
        <TimeAxis
          hourMarkers={hourMarkers}
          rangeStart={startMinutes}
          rangeEnd={endMinutes}
        />

        {/* Stage rows */}
        {stages.map((stage, index) => (
          <StageRow
            key={stage.stageOrder}
            stage={stage}
            rangeStart={startMinutes}
            rangeEnd={endMinutes}
            hourMarkers={hourMarkers}
            isEven={index % 2 === 0}
          />
        ))}
      </div>
    </div>
  )
}
