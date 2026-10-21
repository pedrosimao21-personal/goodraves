'use client'

import type { TimetableData } from '@/db/actions/festivals'
import { parseLocalDate } from '@/lib/dates'
import styles from './FestivalLineup.module.css'

const DAY_DIGITS = 2

/** Short day label, e.g. "Fri 06". */
function formatDayTabLabel(isoDate: string): string {
  const date = parseLocalDate(isoDate)
  const weekday = date.toLocaleDateString('en-US', { weekday: 'short' })
  return `${weekday} ${String(date.getDate()).padStart(DAY_DIGITS, '0')}`
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

function describeDay(timetable: TimetableData, day: string, pickedArtistIds: Set<string>): string {
  const slots = (timetable.stagesByDay[day] ?? []).flatMap((stage) => stage.slots)
  const picks = slots.filter((slot) => pickedArtistIds.has(slot.artistId)).length
  return picks > 0 ? `${plural(slots.length, 'set')} · ${plural(picks, 'pick')}` : plural(slots.length, 'set')
}

interface DayTabsProps {
  timetable: TimetableData
  selectedDay: string | null
  onSelectDay: (day: string) => void
  pickedArtistIds: Set<string>
}

/** Underlined day tabs for a multi-day timetable. Board: Festival. */
export default function DayTabs({ timetable, selectedDay, onSelectDay, pickedArtistIds }: DayTabsProps) {
  return (
    <div className={styles.days} role="tablist" aria-label="Day">
      {timetable.days.map((day) => {
        const isSelected = day === selectedDay
        return (
          <button
            key={day}
            type="button"
            role="tab"
            aria-selected={isSelected}
            className={`${styles.day} ${isSelected ? styles.dayOn : ''}`}
            onClick={() => onSelectDay(day)}
          >
            <span className={`display ${styles.dayName}`}>{formatDayTabLabel(day)}</span>
            <span className="mono">{describeDay(timetable, day, pickedArtistIds)}</span>
          </button>
        )
      })}
    </div>
  )
}
