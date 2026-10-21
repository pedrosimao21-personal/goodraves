'use client'

import { BookmarkIcon } from '@/components/icons'
import styles from './PickButton.module.css'

const ICON_SIZE = 20

type Props = {
  isPicked: boolean
  /** A picked set that overlaps another pick. */
  isClash?: boolean
  /** Names of the set, for the accessible label. */
  name: string
  onToggle: () => void
  className?: string
}

/** Bookmark toggle for one set on the timetable. Lime when picked, orange in a clash. */
export default function PickButton({ isPicked, isClash = false, name, onToggle, className = '' }: Props) {
  const stateClass = isPicked ? (isClash ? styles.clash : styles.picked) : ''
  return (
    <button
      type="button"
      className={`${styles.pick} ${stateClass} ${className}`}
      aria-pressed={isPicked}
      aria-label={isPicked ? `Remove ${name} from your picks` : `Pick ${name}`}
      onClick={onToggle}
    >
      <BookmarkIcon size={ICON_SIZE} filled={isPicked} />
    </button>
  )
}
