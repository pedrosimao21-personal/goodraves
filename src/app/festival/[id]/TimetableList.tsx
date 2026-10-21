'use client'

import Link from 'next/link'
import type { TimetableStage } from '@/db/actions/festivals'
import { collectStartTimes, findDayStart } from '@/lib/timetable-time'
import { groupSlotsByTime, sortGroupsByStart, type SlotGroup } from './timetable-utils'
import PickButton from './PickButton'
import styles from './Timetable.module.css'

type Highlights = {
  pickedArtistIds: Set<string>
  clashArtistIds: Set<string>
  /** Shows a pick toggle per row; omitted once the festival is over. */
  onTogglePick?: (group: SlotGroup) => void
}

type Props = Highlights & {
  stages: TimetableStage[]
}

function isGroupIn(group: SlotGroup, artistIds: Set<string>): boolean {
  return group.artists.some((a) => artistIds.has(a.artistId))
}

function getRowClass(group: SlotGroup, { pickedArtistIds, clashArtistIds }: Highlights): string {
  if (isGroupIn(group, clashArtistIds)) return styles.rowClash
  if (isGroupIn(group, pickedArtistIds)) return styles.rowPicked
  return ''
}

function SlotRow({ group, highlights }: { group: SlotGroup; highlights: Highlights }) {
  const { onTogglePick, pickedArtistIds, clashArtistIds } = highlights
  return (
    <div className={`${styles.row} ${getRowClass(group, highlights)}`}>
      <div className={`mono ${styles.rowTime}`}>
        {group.startTime}
        <br />
        <span className={styles.rowEnd}>{group.endTime}</span>
      </div>
      <div className={styles.rowNames}>
        {group.artists.length > 1 && <span className={styles.b2bTag}>B2B</span>}
        {group.artists.map((artist, index) => (
          <span key={artist.artistId}>
            <Link href={`/artist/${artist.artistId}/${encodeURIComponent(artist.artistName)}`} className={styles.rowLink}>
              {artist.artistName}
            </Link>
            {index < group.artists.length - 1 && ' & '}
          </span>
        ))}
      </div>
      {onTogglePick && (
        <PickButton
          isPicked={isGroupIn(group, pickedArtistIds)}
          isClash={isGroupIn(group, clashArtistIds)}
          name={group.artists.map((a) => a.artistName).join(' & ')}
          onToggle={() => onTogglePick(group)}
        />
      )}
    </div>
  )
}

/** Mobile timetable: one block of rows per stage. Board: FestivalMobile (by stage). */
export default function TimetableList({ stages, pickedArtistIds, clashArtistIds, onTogglePick }: Props) {
  const highlights = { pickedArtistIds, clashArtistIds, onTogglePick }
  const dayStart = findDayStart(collectStartTimes(stages))
  return (
    <div>
      {stages.map(stage => {
        const slotGroups = sortGroupsByStart(groupSlotsByTime(stage.slots), dayStart)
        return (
          <section key={stage.stageOrder} className={styles.listStage}>
            <h3 className={`mono ${styles.listStageName}`}>
              {stage.stageName}<span className={styles.stageCount}> · {slotGroups.length} sets</span>
            </h3>
            {slotGroups.map(group => (
              <SlotRow key={`${group.startTime}-${group.slotOrder}`} group={group} highlights={highlights} />
            ))}
          </section>
        )
      })}
    </div>
  )
}
