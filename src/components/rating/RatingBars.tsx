import { RATING_BAR_COUNT, RATING_STEP, ratingBarColor, snapRating } from '@/lib/rating'
import styles from './Rating.module.css'

const MIN_BAR_HEIGHT_PERCENT = 28
const FULL_HEIGHT_PERCENT = 100

/** Percent height of bar `index`: ascending, like a volume meter. */
function barHeight(index: number): number {
  return MIN_BAR_HEIGHT_PERCENT + ((FULL_HEIGHT_PERCENT - MIN_BAR_HEIGHT_PERCENT) * index) / (RATING_BAR_COUNT - 1)
}

/**
 * The ten ascending meter bars shared by the fader and the read-only meter:
 * one bar per half point, lit up to `value`. Lit bars take their colour from
 * their position (green low, red high), so the value reads without the colour.
 */
export default function RatingBars({ value, className }: { value: number; className: string }) {
  const litCount = snapRating(value) / RATING_STEP
  return (
    <span className={className} aria-hidden="true">
      {Array.from({ length: RATING_BAR_COUNT }, (_, index) => (
        <i
          key={index}
          className={index < litCount ? styles.lit : undefined}
          style={{ height: `${barHeight(index)}%`, ['--bar' as string]: ratingBarColor(index) }}
        />
      ))}
    </span>
  )
}
