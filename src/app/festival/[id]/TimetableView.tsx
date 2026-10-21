'use client'

import type { TimetableStage } from '@/db/actions/festivals'
import TimetableGantt from './TimetableGantt'
import TimetableList from './TimetableList'
import styles from './Timetable.module.css'

type Props = {
  stages: TimetableStage[]
  /** Sets the user picked; outlined in lime. */
  pickedArtistIds: Set<string>
  /** Picked sets that overlap another pick; outlined in orange. */
  clashArtistIds: Set<string>
}

// Both views render server-side; a CSS media query (not JS) decides which is
// visible, so there's no hydration mismatch or first-paint flash from
// measuring viewport width on the client.
export default function TimetableView({ stages, pickedArtistIds, clashArtistIds }: Props) {
  return (
    <>
      <div className={styles.ganttWrapper}>
        <TimetableGantt stages={stages} pickedArtistIds={pickedArtistIds} clashArtistIds={clashArtistIds} />
      </div>
      <div className={styles.listWrapper}>
        <TimetableList stages={stages} pickedArtistIds={pickedArtistIds} clashArtistIds={clashArtistIds} />
      </div>
    </>
  )
}
