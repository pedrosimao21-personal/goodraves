import { RATING_MAX, formatRating } from '@/lib/rating'
import styles from './Rating.module.css'

const PERCENT = 100

const SIZE_CLASS = { sm: styles.squaresSmall, md: '', lg: styles.squaresLarge } as const

/**
 * Read-only rating: full squares, then a partial square for the decimal
 * (4.6 shows four full and 60% of the fifth; a half point 4.5 shows half).
 */
export default function RatingSquares({ value, size = 'md' }: { value: number; size?: keyof typeof SIZE_CLASS }) {
  const clamped = Math.max(0, Math.min(RATING_MAX, value))
  const label = `${formatRating(Number.isInteger(clamped) ? clamped : Math.round(clamped * 10) / 10)} out of ${RATING_MAX}`

  return (
    <span className={`${styles.squares} ${SIZE_CLASS[size]}`} role="img" aria-label={label}>
      {Array.from({ length: RATING_MAX }, (_, index) => {
        const fill = Math.max(0, Math.min(1, clamped - index))
        const percent = Math.round(fill * PERCENT)
        const background = percent === 0
          ? undefined
          : `linear-gradient(90deg, var(--gr-acc-ink) ${percent}%, var(--gr-s3) ${percent}%)`
        return <i key={index} className={styles.square} style={background ? { background } : undefined} />
      })}
    </span>
  )
}
