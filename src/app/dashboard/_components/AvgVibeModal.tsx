'use client'

import Link from 'next/link'
import Sheet from '@/components/Sheet'
import RatingSquares from '@/components/rating/RatingSquares'
import { formatDate } from '@/lib/format-date'
import type { RatedFestival } from './use-my-festivals'
import styles from './AvgVibeModal.module.css'

/** Every rated festival, best first. */
export default function AvgVibeModal({ festivals, onClose }: { festivals: RatedFestival[]; onClose: () => void }) {
  return (
    <Sheet title="Your vibe ratings" eyebrow={`${festivals.length} rated`} onClose={onClose}>
      {festivals.length === 0 ? (
        <p className="form-hint">No rated festivals yet. Rate the vibe on a festival you attended.</p>
      ) : (
        <div className={styles.sheetList}>
          {festivals.map(fest => (
            <Link key={fest.id} href={`/festival/${fest.id}`} onClick={onClose} className={styles.sheetRow}>
              <span className={styles.sheetRowInfo}>
                <span className={styles.sheetRowName}>{fest.name}</span>
                {fest.date && <span className={`mono ${styles.muted}`}>{formatDate(fest.date)}</span>}
              </span>
              <RatingSquares value={fest.rating} size="sm" />
            </Link>
          ))}
        </div>
      )}
    </Sheet>
  )
}
