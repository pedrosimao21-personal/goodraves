'use client'

import { useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react'
import {
  RATING_MAX,
  RATING_STEP,
  formatRating,
  snapRating,
} from '@/lib/rating'
import RatingBars from './RatingBars'
import styles from './Rating.module.css'

/** Pixels of sideways travel before a touch counts as a drag instead of a tap. */
const DRAG_START_PX = 6
/** The cap's half width, which is also the rail's inset: value 0 and RATING_MAX sit this far from the ends. */
const CAP_INSET_PX = 7
const NOTCH_COUNT = RATING_MAX

interface RatingFaderProps {
  /** 0 = not rated, otherwise 0.5..5 in half points. */
  value: number
  /** Called with the new rating; tapping the current value clears it (0). */
  onChange: (rating: number) => void
  /** Accessible name of the slider, e.g. "Rate Nora Vey". */
  label: string
}

function stopCardClick(event: MouseEvent) {
  // Rating rows sit inside cards with their own click handlers or links.
  event.preventDefault()
  event.stopPropagation()
}

/**
 * Rating fader: a volume meter of ten bars (one per half point) with a cap on a
 * rail below. Tap anywhere to set the nearest half point (tapping the current
 * value clears it), or drag the cap sideways. Vertical swipes still scroll the
 * page (touch-action: pan-y), so it is safe inside lineup grids.
 */
export default function RatingFader({ value, onChange, label }: RatingFaderProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const gesture = useRef({ startX: 0, startValue: 0, isDragging: false })
  const [draftValue, setDraftValue] = useState<number | null>(null)
  const shown = draftValue ?? value

  const valueAt = (clientX: number): number => {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect) return value
    const travel = rect.width - CAP_INSET_PX * 2
    return snapRating(((clientX - rect.left - CAP_INSET_PX) / travel) * RATING_MAX)
  }

  const handlePointerDown = (event: PointerEvent) => {
    gesture.current = { startX: event.clientX, startValue: value, isDragging: false }
    // Touch pointers are captured by the browser (so a scroll can take over); a mouse needs it for drags that leave the track.
    if (event.pointerType === 'mouse') event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: PointerEvent) => {
    const state = gesture.current
    if (!(event.buttons || event.pointerType === 'touch')) return
    if (!state.isDragging && Math.abs(event.clientX - state.startX) > DRAG_START_PX) state.isDragging = true
    if (state.isDragging) setDraftValue(valueAt(event.clientX))
  }

  const handlePointerUp = (event: PointerEvent) => {
    const state = gesture.current
    if (state.isDragging) {
      onChange(valueAt(event.clientX))
    } else {
      const tapped = valueAt(event.clientX)
      onChange(tapped === state.startValue || tapped === 0 ? 0 : tapped)
    }
    state.isDragging = false
    setDraftValue(null)
  }

  const handlePointerCancel = () => {
    // The browser took the gesture over to scroll the page: leave the rating alone.
    gesture.current.isDragging = false
    setDraftValue(null)
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    const steps: Record<string, number> = { ArrowRight: RATING_STEP, ArrowUp: RATING_STEP, ArrowLeft: -RATING_STEP, ArrowDown: -RATING_STEP }
    if (event.key in steps) onChange(snapRating(value + steps[event.key]))
    else if (event.key === 'Home') onChange(0)
    else if (event.key === 'End') onChange(RATING_MAX)
    else return
    event.preventDefault()
  }

  const position = (rating: number) => `calc(${CAP_INSET_PX}px + (100% - ${CAP_INSET_PX * 2}px) * ${rating / RATING_MAX})`

  return (
    <div
      ref={trackRef}
      className={`${styles.fader} ${draftValue !== null ? styles.dragging : ''}`}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={RATING_MAX}
      aria-valuenow={shown}
      aria-valuetext={shown > 0 ? `${formatRating(shown)} of ${RATING_MAX}` : 'not rated'}
      onClick={stopCardClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onKeyDown={handleKeyDown}
    >
      <RatingBars value={shown} className={styles.faderBars} />
      <span className={styles.rail} aria-hidden="true" />
      {Array.from({ length: NOTCH_COUNT }, (_, index) => (
        <span key={index} className={styles.notch} style={{ left: position(index + 1) }} aria-hidden="true" />
      ))}
      <span className={`${styles.cap} ${shown === 0 ? styles.capOff : ''}`} style={{ left: position(shown) }} aria-hidden="true" />
    </div>
  )
}
