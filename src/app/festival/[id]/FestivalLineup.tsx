'use client'

import { useEffect, useMemo, useState } from 'react'
import { useUserData } from '@/context/UserDataContext'
import type { TimetableData } from '@/db/actions/festivals'
import ArtistCard from '@/components/ArtistCard'
import B2bSetCard from '@/components/B2bSetCard'
import { findClashes } from '@/lib/timetable-clash'
import ClashBanner from './ClashBanner'
import DayTabs from './DayTabs'
import TimetableView from './TimetableView'
import type { FestivalEvent } from './festival-event'
import { type LineupView, useLineupView } from './use-lineup-view'
import styles from './FestivalLineup.module.css'

const VIEW_LABELS: Record<LineupView, string> = { artists: 'Artists', timetable: 'Timetable' }

function countStages(timetable: TimetableData): number {
  const names = Object.values(timetable.stagesByDay).flatMap((stages) => stages.map((stage) => stage.stageName))
  return new Set(names).size
}

interface FestivalLineupProps {
  id: string
  event: FestivalEvent
  timetable: TimetableData
  spotifyData: Record<string, any>
  isFuture: boolean
}

/** Lineup heading, Artists / Timetable switch and the selected view. Board: Festival. */
export default function FestivalLineup({ id, event, timetable, spotifyData, isFuture }: FestivalLineupProps) {
  const { getB2bSets, wantToSee } = useUserData()
  const { view, switchView } = useLineupView()
  const [selectedDay, setSelectedDay] = useState<string | null>(() => timetable.days[0] ?? null)

  // Keep the selected day valid when the day list changes (another festival,
  // or a refresh after linking a Partyflock timetable).
  useEffect(() => {
    setSelectedDay((prev) => (prev && timetable.days.includes(prev) ? prev : (timetable.days[0] ?? null)))
  }, [timetable.days])

  const b2bSets = getB2bSets(id)
  const { soloArtists, allSoloForB2b } = useMemo(() => {
    const b2bMemberIds = new Set(b2bSets.flatMap(s => s.members.map(m => m.artistId)))
    const b2bOriginalNames = new Set(b2bSets.map(s => s.originalArtistName.toLowerCase()))
    const solo = event.attractions.filter(
      (artist: any) => !b2bMemberIds.has(artist.id) && !b2bOriginalNames.has(artist.name.toLowerCase())
    )
    // Computed once here rather than per card.
    return { soloArtists: solo, allSoloForB2b: solo.map((a: any) => ({ id: a.id, name: a.name })) }
  }, [b2bSets, event])

  const pickedArtistIds = useMemo(() => new Set(wantToSee[id] ?? []), [wantToSee, id])
  const clashes = useMemo(() => findClashes(timetable, pickedArtistIds), [timetable, pickedArtistIds])
  const activeDay = selectedDay ?? timetable.days[0]
  const clashArtistIds = useMemo(() => new Set(
    clashes.filter((c) => c.slotDate === activeDay).flatMap((c) => [c.a.artistId, c.b.artistId])
  ), [clashes, activeDay])

  const artistCount = event.attractions.length
  const stageCount = countStages(timetable)
  const hasTimetable = timetable.days.length > 0
  const summary = [
    `${artistCount} artist${artistCount === 1 ? '' : 's'}`,
    stageCount > 0 ? `${stageCount} stage${stageCount === 1 ? '' : 's'}` : null,
  ].filter(Boolean).join(' · ')

  if (artistCount === 0) {
    return (
      <section className={styles.section}>
        <h2 className={`display ${styles.title}`}>Lineup</h2>
        <p className={styles.empty}>The lineup for this event hasn&apos;t been announced yet.</p>
      </section>
    )
  }

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <div className={styles.heading}>
          <h2 className={`display ${styles.title}`}>Lineup</h2>
          <span className={`mono ${styles.summary}`}>{summary}</span>
        </div>
        {hasTimetable && (
          <div className={styles.seg} role="tablist" aria-label="View">
            {(Object.keys(VIEW_LABELS) as LineupView[]).map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={view === key}
                className={view === key ? styles.segOn : undefined}
                onClick={() => switchView(key)}
              >
                {VIEW_LABELS[key]}
              </button>
            ))}
          </div>
        )}
      </div>

      {view === 'timetable' && hasTimetable ? (
        <>
          {timetable.days.length > 1 && (
            <DayTabs timetable={timetable} selectedDay={activeDay} onSelectDay={setSelectedDay} pickedArtistIds={pickedArtistIds} />
          )}
          <ClashBanner clashes={clashes} />
          <TimetableView
            stages={timetable.stagesByDay[activeDay] ?? []}
            pickedArtistIds={pickedArtistIds}
            clashArtistIds={clashArtistIds}
          />
          {pickedArtistIds.size > 0 && <p className={`mono ${styles.footnote}`}>Your picks are outlined in lime</p>}
        </>
      ) : (
        <div className={styles.grid}>
          {b2bSets.map(b2bSet => (
            <B2bSetCard key={b2bSet.id} b2bSet={b2bSet} eventId={id} spotifyData={spotifyData} isPast={!isFuture} />
          ))}
          {soloArtists.map((artist: any) => (
            <ArtistCard
              key={artist.id}
              artist={artist}
              eventId={id}
              spotifyData={spotifyData[artist.name]}
              isPast={!isFuture}
              availableArtistsForB2b={allSoloForB2b}
            />
          ))}
        </div>
      )}
    </section>
  )
}
