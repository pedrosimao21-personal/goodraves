'use client'

import { useMemo } from 'react'
import type { TimetableData } from '@/db/actions/festivals'
import { CalendarIcon, PlusIcon } from '@/components/icons'
import { buildScheduleDay } from './schedule-builder'
import { exportScheduleToCalendar } from './schedule-export'
import type { SlotGroup } from './timetable-utils'
import ScheduleDay from './ScheduleDay'
import styles from './Schedule.module.css'

type Props = {
  festival: { id: string; name: string; venue?: string | null }
  timetable: TimetableData
  activeDay: string
  pickedArtistIds: Set<string>
  /** Omitted once the festival is over: the schedule is then read-only. */
  onTogglePick?: (group: SlotGroup) => void
  /** Opens the By stage view (mobile only; desktop shows the Gantt above). */
  onBrowseStages: () => void
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

/**
 * The user's picks per day, with free time and clashes. The selected day leads;
 * on desktop the other days sit in a side column, on mobile the day tabs above
 * switch between them. Board: Festival ("Your schedule") and FestivalMobile.
 */
export default function YourSchedule({ festival, timetable, activeDay, pickedArtistIds, onTogglePick, onBrowseStages }: Props) {
  const days = useMemo(
    () => timetable.days.map((day) => buildScheduleDay(timetable, day, pickedArtistIds)),
    [timetable, pickedArtistIds],
  )
  const active = days.find((day) => day.day === activeDay) ?? days[0]
  const others = days.filter((day) => day !== active)
  const pickCount = days.reduce((sum, day) => sum + day.pickCount, 0)
  const daysWithPicks = days.filter((day) => day.pickCount > 0).length
  const summary = days.length > 1 ? `${plural(pickCount, 'pick')} over ${plural(daysWithPicks, 'day')}` : plural(pickCount, 'pick')

  if (pickCount === 0 && !onTogglePick) return null

  return (
    <section className={styles.schedule} aria-labelledby="your-schedule-title">
      <div className={styles.header}>
        <h2 id="your-schedule-title" className={`display ${styles.title}`}>Your schedule</h2>
        {pickCount > 0 && <span className={`mono ${styles.summary}`}>{summary}</span>}
      </div>

      {pickCount === 0 ? (
        <p className={styles.empty}>Pick sets from the timetable and they show up here in time order, with the free time between them and any clashes.</p>
      ) : (
        <div className={styles.columns}>
          <div className={styles.main}>{active && <ScheduleDay day={active} onTogglePick={onTogglePick} />}</div>
          {others.length > 0 && (
            <div className={styles.side}>
              {others.map((day) => <ScheduleDay key={day.day} day={day} onTogglePick={onTogglePick} />)}
            </div>
          )}
        </div>
      )}

      <div className={styles.actions}>
        {pickCount > 0 && (
          <button type="button" className="btn" onClick={() => exportScheduleToCalendar(festival, days)}>
            <CalendarIcon size={16} />Export picks to calendar
          </button>
        )}
        {onTogglePick && (
          <button type="button" className={`btn ${styles.browse}`} onClick={onBrowseStages}>
            <PlusIcon size={16} strokeWidth={2} />Add sets by stage
          </button>
        )}
      </div>
    </section>
  )
}
