'use client'

import { useEffect, useMemo, useState } from 'react'
import { useUserData } from '@/context/UserDataContext'
import type { TimetableData } from '@/db/actions/festivals'
import { findClashes } from '@/lib/timetable-clash'
import type { FestivalPhase } from '@/lib/festival-date'
import DayTabs from './DayTabs'
import TimetableGantt from './TimetableGantt'
import TimetableList from './TimetableList'
import YourSchedule from './YourSchedule'
import LineupArtistGrid from './LineupArtistGrid'
import LineupViewSwitch from './LineupViewSwitch'
import type { FestivalEvent } from './festival-event'
import { type LineupView, useLineupView } from './use-lineup-view'
import { usePicks } from './use-picks'
import styles from './FestivalLineup.module.css'

function countStages(timetable: TimetableData): number {
  const names = Object.values(timetable.stagesByDay).flatMap((stages) => stages.map((stage) => stage.stageName))
  return new Set(names).size
}

/**
 * The view a visitor lands on: A–Z without a timetable or once the festival is
 * over (rating happens on the cards), else My schedule if they already had
 * picks and By stage if not. Desktop shows the Gantt for both.
 */
function pickDefaultView(hasTimetable: boolean, phase: FestivalPhase, hasPicks: boolean): LineupView {
  if (!hasTimetable || phase === 'past') return 'artists'
  return hasPicks ? 'schedule' : 'timetable'
}

interface FestivalLineupProps {
  id: string
  event: FestivalEvent
  timetable: TimetableData
  spotifyData: Record<string, any>
  phase: FestivalPhase
}

/** Lineup heading, the view switch and the selected view. Boards: Festival and FestivalMobile. */
export default function FestivalLineup({ id, event, timetable, spotifyData, phase }: FestivalLineupProps) {
  const { getSeenCount } = useUserData()
  const { pickedArtistIds, togglePick } = usePicks(id)
  // Read once, so picking the first set doesn't move the visitor to another view.
  const [hadPicksOnLoad] = useState(() => pickedArtistIds.size > 0)
  const hasTimetable = timetable.days.length > 0
  const { view, switchView } = useLineupView(pickDefaultView(hasTimetable, phase, hadPicksOnLoad))
  const [selectedDay, setSelectedDay] = useState<string | null>(() => timetable.days[0] ?? null)
  // While it runs you can still pick sets for later and rate the ones you saw.
  const canPick = phase !== 'past'
  const canRate = phase !== 'upcoming'
  const onTogglePick = canPick ? togglePick : undefined

  // Keep the selected day valid when the day list changes (another festival,
  // or a refresh after linking a Partyflock timetable).
  useEffect(() => {
    setSelectedDay((prev) => (prev && timetable.days.includes(prev) ? prev : (timetable.days[0] ?? null)))
  }, [timetable.days])

  const clashes = useMemo(() => findClashes(timetable, pickedArtistIds), [timetable, pickedArtistIds])
  const activeDay = selectedDay ?? timetable.days[0]
  const clashArtistIds = useMemo(() => new Set(
    clashes.filter((c) => c.slotDate === activeDay).flatMap((c) => [c.a.artistId, c.b.artistId])
  ), [clashes, activeDay])

  const artistCount = event.attractions.length
  const stageCount = countStages(timetable)
  const seenCount = getSeenCount(id)
  const summary = [
    `${artistCount} artist${artistCount === 1 ? '' : 's'}`,
    stageCount > 0 ? `${stageCount} stage${stageCount === 1 ? '' : 's'}` : null,
    seenCount > 0 ? `${seenCount} seen` : null,
  ].filter(Boolean).join(' · ')

  if (artistCount === 0) {
    return (
      <section className={styles.section}>
        <h2 className={`display ${styles.title}`}>Lineup</h2>
        <p className={styles.empty}>The lineup for this event hasn&apos;t been announced yet.</p>
      </section>
    )
  }

  const stages = timetable.stagesByDay[activeDay] ?? []
  const highlights = { pickedArtistIds, clashArtistIds, onTogglePick }

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <div className={styles.heading}>
          <h2 className={`display ${styles.title}`}>Lineup</h2>
          <span className={`mono ${styles.summary}`}>{summary}</span>
        </div>
        {hasTimetable && <LineupViewSwitch view={view} onSwitch={switchView} />}
      </div>

      {view !== 'artists' && hasTimetable ? (
        <>
          {timetable.days.length > 1 && (
            <DayTabs timetable={timetable} selectedDay={activeDay} onSelectDay={setSelectedDay} pickedArtistIds={pickedArtistIds} />
          )}
          <div className={styles.desktopOnly}>
            <TimetableGantt stages={stages} {...highlights} />
            {canPick && <p className={`mono ${styles.footnote}`}>Tap a set to pick it · your picks are outlined in lime</p>}
          </div>
          {view === 'timetable' && (
            <div className={styles.mobileOnly}><TimetableList stages={stages} {...highlights} /></div>
          )}
          <div className={view === 'timetable' ? styles.desktopOnly : undefined}>
            <YourSchedule
              festival={{ id, name: event.name, venue: event.venue?.name }}
              timetable={timetable}
              activeDay={activeDay}
              pickedArtistIds={pickedArtistIds}
              onTogglePick={onTogglePick}
              onBrowseStages={() => switchView('timetable')}
            />
          </div>
        </>
      ) : (
        <LineupArtistGrid id={id} event={event} spotifyData={spotifyData} canPick={canPick} canRate={canRate} />
      )}
    </section>
  )
}
