'use client'

import Link from 'next/link'
import type { TimetableStage } from '@/db/actions/festivals'
import { collectStartTimes, findDayStart } from '@/lib/timetable-time'
import { groupSlotsByTime, sortGroupsByStart, type SlotGroup } from './timetable-utils'
import styles from './Timetable.module.css'

type Highlights = {
  pickedArtistIds: Set<string>
  clashArtistIds: Set<string>
}

type Props = Highlights & {
  stages: TimetableStage[]
}

function getRowClass(group: SlotGroup, { pickedArtistIds, clashArtistIds }: Highlights): string {
  if (group.artists.some((a) => clashArtistIds.has(a.artistId))) return styles.rowClash
  if (group.artists.some((a) => pickedArtistIds.has(a.artistId))) return styles.rowPicked
  return ''
}

function SlotRow({ group, highlights }: { group: SlotGroup; highlights: Highlights }) {
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
    </div>
  )
}

/** Mobile timetable: one block of rows per stage. Board: FestivalMobile (by stage). */
export default function TimetableList({ stages, pickedArtistIds, clashArtistIds }: Props) {
  const highlights = { pickedArtistIds, clashArtistIds }
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
