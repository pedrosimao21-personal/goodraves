import { RATING_MAX, formatRating, snapRating } from '@/lib/rating'
import RatingBars from './RatingBars'
import styles from './Rating.module.css'

const SIZE_CLASS = { sm: styles.meterSmall, md: '', lg: styles.meterLarge } as const

/**
 * Read-only rating: the fader's volume meter without the fader. Averages such
 * as 4.6 light the nearest half point (4.5).
 */
export default function RatingMeter({ value, size = 'md' }: { value: number; size?: keyof typeof SIZE_CLASS }) {
  const clamped = Math.max(0, Math.min(RATING_MAX, value))
  const label = `${formatRating(Number.isInteger(clamped) ? clamped : Math.round(clamped * 10) / 10)} out of ${RATING_MAX}`

  return (
    <span className={`${styles.meter} ${SIZE_CLASS[size]}`} role="img" aria-label={label}>
      <RatingBars value={snapRating(clamped)} className={styles.meterBars} />
    </span>
  )
}
