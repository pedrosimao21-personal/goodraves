'use client'

import type { TimetableStage } from '@/db/actions/festivals'
import TimetableGantt from './TimetableGantt'
import TimetableList from './TimetableList'

type Props = {
  stages: TimetableStage[]
}

// Both views render server-side; a CSS media query (not JS) decides which is
// visible, so there's no hydration mismatch or first-paint flash from
// measuring viewport width on the client.
export default function TimetableView({ stages }: Props) {
  return (
    <>
      <div className="timetable-gantt-wrapper">
        <TimetableGantt stages={stages} />
      </div>
      <div className="timetable-list-wrapper">
        <TimetableList stages={stages} />
      </div>
    </>
  )
}
