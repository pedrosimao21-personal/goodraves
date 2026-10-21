'use client'

import type { ReactNode } from 'react'
import RatingSquares from '@/components/rating/RatingSquares'
import { ArrowRightIcon } from '@/components/icons'
import styles from './Dashboard.module.css'

function describeNext(daysUntilNext: number | null): string {
  if (daysUntilNext === null) return ''
  if (daysUntilNext <= 0) return ' · now'
  if (daysUntilNext === 1) return ' · next tomorrow'
  return ` · next in ${daysUntilNext} days`
}

function StatButton({ value, label, onClick, valueClassName = '', extra }: {
  value: string
  label: string
  onClick: () => void
  valueClassName?: string
  extra?: ReactNode
}) {
  return (
    <button type="button" className={styles.stat} onClick={onClick}>
      <span className={styles.statValue}>
        <span className={`display ${valueClassName}`}>{value}</span>
        {extra}
      </span>
      <span className={`mono ${styles.statLabel}`}>
        {label}<ArrowRightIcon size={14} strokeWidth={2} />
      </span>
    </button>
  )
}

interface DashboardStatsProps {
  attendedCount: number
  upcomingCount: number
  firstYear: number | null
  daysUntilNext: number | null
  averageVibe: number
  ratedCount: number
  artistsSeen: number
  onShowPast: () => void
  onShowUpcoming: () => void
  onShowVibes: () => void
  onShowArtists: () => void
}

/** Four tappable numbers. Board: MyFestivals / MyFestivalsMobile. */
export default function DashboardStats(props: DashboardStatsProps) {
  const { attendedCount, upcomingCount, firstYear, daysUntilNext, averageVibe, ratedCount, artistsSeen } = props
  return (
    <div className={styles.stats}>
      <StatButton
        value={String(attendedCount)}
        label={`Attended${firstYear ? ` · since ${firstYear}` : ''}`}
        onClick={props.onShowPast}
      />
      <StatButton
        value={String(upcomingCount)}
        label={`Upcoming${describeNext(daysUntilNext)}`}
        valueClassName={styles.goValue}
        onClick={props.onShowUpcoming}
      />
      <StatButton
        value={averageVibe > 0 ? averageVibe.toFixed(1) : '–'}
        label={`Average vibe · ${ratedCount} rated`}
        extra={averageVibe > 0 ? <RatingSquares value={averageVibe} /> : null}
        onClick={props.onShowVibes}
      />
      <StatButton value={String(artistsSeen)} label="Artists seen" onClick={props.onShowArtists} />
    </div>
  )
}
