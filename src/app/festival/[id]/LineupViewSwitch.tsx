'use client'

import type { LineupView } from './use-lineup-view'
import styles from './FestivalLineup.module.css'

type Option = { view: LineupView; label: string }

// Desktop shows Your schedule under the Gantt, so it needs no tab of its own.
const DESKTOP_OPTIONS: Option[] = [
  { view: 'timetable', label: 'Timetable' },
  { view: 'artists', label: 'A–Z' },
]

const MOBILE_OPTIONS: Option[] = [
  { view: 'schedule', label: 'My schedule' },
  { view: 'timetable', label: 'By stage' },
  { view: 'artists', label: 'A–Z' },
]

function SegmentedControl({ options, selected, onSwitch, className }: {
  options: Option[]
  selected: LineupView
  onSwitch: (view: LineupView) => void
  className: string
}) {
  return (
    <div className={`${styles.seg} ${className}`} role="tablist" aria-label="View">
      {options.map((option) => (
        <button
          key={option.view}
          type="button"
          role="tab"
          aria-selected={selected === option.view}
          className={selected === option.view ? styles.segOn : undefined}
          onClick={() => onSwitch(option.view)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

/**
 * The lineup's view switch: Timetable / A–Z on desktop, My schedule / By
 * stage / A–Z on mobile. Both render; CSS shows the one for the breakpoint.
 * Boards: Festival and FestivalMobile.
 */
export default function LineupViewSwitch({ view, onSwitch }: { view: LineupView; onSwitch: (view: LineupView) => void }) {
  return (
    <>
      <SegmentedControl
        options={DESKTOP_OPTIONS}
        selected={view === 'artists' ? 'artists' : 'timetable'}
        onSwitch={onSwitch}
        className={styles.desktopOnly}
      />
      <SegmentedControl options={MOBILE_OPTIONS} selected={view} onSwitch={onSwitch} className={styles.mobileOnly} />
    </>
  )
}
