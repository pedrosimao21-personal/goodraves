'use client'

import { buildIcsCalendar, downloadIcsFile, type IcsFestival } from '@/lib/ics'

function CalendarPlusIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/><line x1="12" y1="14" x2="12" y2="18"/><line x1="10" y1="16" x2="14" y2="16"/>
    </svg>
  )
}

/** Sluggifies a festival name for a filesystem-safe .ics filename. */
function toFilename(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'festival'
}

export default function AddToCalendarButton({ festival }: { festival: IcsFestival }) {
  const handleClick = () => {
    downloadIcsFile(`${toFilename(festival.name)}.ics`, buildIcsCalendar([festival]))
  }

  return (
    <button onClick={handleClick} className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <CalendarPlusIcon /> Add to Calendar
    </button>
  )
}
