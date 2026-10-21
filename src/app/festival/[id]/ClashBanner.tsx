'use client'

import type { Clash } from '@/lib/timetable-clash'
import { WarningIcon } from '@/components/icons'
import styles from './Timetable.module.css'

/** Orange box listing each pair of picked sets that overlap. */
export default function ClashBanner({ clashes }: { clashes: Clash[] }) {
  if (clashes.length === 0) return null

  return (
    <div className={styles.clash} role="group" aria-label="Clashes in your picks">
      <div className={styles.clashTitle}>
        <WarningIcon size={16} />
        <span className="mono">{clashes.length} clash{clashes.length !== 1 ? 'es' : ''} in your picks</span>
      </div>
      {clashes.map((c, i) => (
        <p key={i} className={styles.clashRow}>
          <strong>{c.a.artistName}</strong> <span className="mono">{c.a.stageName} · {c.a.startTime}–{c.a.endTime}</span>
          {' '}overlaps{' '}
          <strong>{c.b.artistName}</strong> <span className="mono">{c.b.stageName} · {c.b.startTime}–{c.b.endTime}</span>
        </p>
      ))}
    </div>
  )
}
