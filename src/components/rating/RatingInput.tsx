'use client'

import { useState, type MouseEvent } from 'react'
import { RATING_MAX } from './RatingSquares'
import styles from './Rating.module.css'

interface RatingInputProps {
  value: number
  /** Called with the new rating; tapping the current value clears it (0). */
  onChange: (rating: number) => void
  /** Accessible name of the group, e.g. "Rate Nora Vey". */
  label: string
  /** 'lg' is the full-width vibe rating. */
  size?: 'md' | 'lg'
  idPrefix?: string
}

export default function RatingInput({ value, onChange, label, size = 'md', idPrefix }: RatingInputProps) {
  const [hover, setHover] = useState(0)

  const handleClick = (event: MouseEvent, rating: number) => {
    // Rating rows sit inside cards with their own click handlers or links.
    event.preventDefault()
    event.stopPropagation()
    onChange(rating === value ? 0 : rating)
  }

  return (
    <div
      className={`${styles.input} ${size === 'lg' ? styles.large : ''}`}
      role="group"
      aria-label={label}
      onMouseLeave={() => setHover(0)}
    >
      {Array.from({ length: RATING_MAX }, (_, index) => {
        const rating = index + 1
        const isOn = rating <= value
        const isPreview = !isOn && rating <= hover
        return (
          <button
            key={rating}
            type="button"
            id={idPrefix ? `${idPrefix}-${rating}` : undefined}
            className={styles.inputButton}
            aria-label={`${rating} of ${RATING_MAX}`}
            aria-pressed={rating === value}
            onClick={(event) => handleClick(event, rating)}
            onMouseEnter={() => setHover(rating)}
          >
            <span className={`${styles.inputSquare} ${isOn ? styles.on : ''} ${isPreview ? styles.preview : ''}`} />
          </button>
        )
      })}
    </div>
  )
}
