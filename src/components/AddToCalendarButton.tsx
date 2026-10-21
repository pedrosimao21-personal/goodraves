'use client'

import { buildIcsCalendar, downloadIcsFile, type IcsFestival } from '@/lib/ics'
import { CalendarIcon } from '@/components/icons'

/** Sluggifies a festival name for a filesystem-safe .ics filename. */
function toFilename(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'festival'
}

export default function AddToCalendarButton({ festival, className = '', labelClassName = '' }: {
  festival: IcsFestival
  className?: string
  /** Lets the caller hide the text on small screens; the button keeps its aria-label. */
  labelClassName?: string
}) {
  const handleClick = () => {
    downloadIcsFile(`${toFilename(festival.name)}.ics`, buildIcsCalendar([festival]))
  }

  return (
    <button type="button" onClick={handleClick} className={`btn ${className}`} aria-label="Add to calendar">
      <CalendarIcon size={18} />
      <span className={labelClassName}>Add to calendar</span>
    </button>
  )
}
