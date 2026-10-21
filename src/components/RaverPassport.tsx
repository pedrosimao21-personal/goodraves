'use client'

import { forwardRef } from 'react'
import { normalizeLocation } from '@/utils/location-normalizer'
import styles from './RaverPassport.module.css'

const RANK_DIGITS = 2
// Fixed bar widths (px) for the decorative barcode; a fixed pattern avoids an SSR/client mismatch.
const BARCODE_BARS = [2, 4, 2, 2, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 2, 2, 4]

function findTopCity(events: any[]): string | null {
  const counts: Record<string, number> = {}
  events.forEach(e => {
    const city = normalizeLocation(e.venue?.city || e.location || null)
    if (city) counts[city] = (counts[city] || 0) + 1
  })
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  // "Rotterdam, Netherlands" → "Rotterdam": the card has room for the city only.
  return top ? top.split(',')[0] : null
}

/**
 * Shareable "passport" card, exported as an image with html2canvas (see
 * insights/PassportSection). Its colours are fixed in the stylesheet, not
 * theme tokens, so the image looks the same in dark and light mode.
 * Board: Insights (Raver passport).
 */
const RaverPassport = forwardRef<HTMLDivElement, {
  events: any[]
  topArtists: string[]
  topGenre?: string
  totalArtists: number
  periodLabel?: string
}>(({ events, topArtists, topGenre, totalArtists, periodLabel = 'All time' }, ref) => {
  const topCity = findTopCity(events)

  return (
    <div ref={ref} className={styles.card}>
      <div className={styles.band}>
        <span className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true" />
          <span className={`display ${styles.brandName}`}>Goodraves</span>
        </span>
        <span className="mono">{periodLabel} edition</span>
      </div>

      <div className={styles.body}>
        <div>
          <span className={`display ${styles.bigNumber}`}>{events.length}</span>
          <p className={`mono ${styles.bigLabel}`}>
            Festival{events.length === 1 ? '' : 's'} · {totalArtists} unique artist{totalArtists === 1 ? '' : 's'}
          </p>
        </div>

        <div className={styles.pair}>
          <div>
            <p className={`mono ${styles.label}`}>Top genre</p>
            <p className={`display ${styles.value}`}>{topGenre || '–'}</p>
          </div>
          <div>
            <p className={`mono ${styles.label}`}>Home base</p>
            <p className={`display ${styles.value}`}>{topCity || '–'}</p>
          </div>
        </div>

        <div className={styles.section}>
          <p className={`mono ${styles.label}`}>Top DJs</p>
          {topArtists.length > 0 ? (
            <ol className={styles.list}>
              {topArtists.map((artist, idx) => (
                <li key={artist} className={styles.listItem}>
                  <span className={`mono ${styles.rank}`}>{String(idx + 1).padStart(RANK_DIGITS, '0')}</span>
                  <span className={styles.artist}>{artist}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className={styles.empty}>No artists yet</p>
          )}
        </div>
      </div>

      <div className={styles.footer}>
        <div className={styles.barcode} aria-hidden="true">
          {BARCODE_BARS.map((width, i) => <span key={i} style={{ width }} />)}
        </div>
        <span className="mono">Tracked on Goodraves</span>
      </div>
    </div>
  )
})

RaverPassport.displayName = 'RaverPassport'

export default RaverPassport
