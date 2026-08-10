import { addDays } from './dates'

const ICS_LINE_ENDING = '\r\n'

export type IcsFestival = {
  id: string
  name: string
  date: string
  endDate?: string | null
  venueName?: string | null
  location?: string | null
}

/** Escape text per RFC 5545 §3.3.11 — backslash, then the characters it introduces. */
function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

/** "YYYY-MM-DD" -> "YYYYMMDD" for an all-day VALUE=DATE field. */
function toIcsDate(isoDate: string): string {
  return isoDate.replace(/-/g, '')
}

function buildEvent(festival: IcsFestival): string {
  // All-day DTEND is exclusive per RFC 5545 — the day *after* the last day
  // of the event, even for a single-day festival (endDate falls back to date).
  const dtEnd = toIcsDate(addDays(festival.endDate || festival.date, 1))
  const location = [festival.venueName, festival.location].filter(Boolean).join(', ')
  const url = `https://goodraves.vercel.app/festival/${festival.id}`

  const lines = [
    'BEGIN:VEVENT',
    `UID:${festival.id}@goodraves`,
    `SUMMARY:${escapeIcsText(festival.name)}`,
    `DTSTART;VALUE=DATE:${toIcsDate(festival.date)}`,
    `DTEND;VALUE=DATE:${dtEnd}`,
    ...(location ? [`LOCATION:${escapeIcsText(location)}`] : []),
    `URL:${url}`,
    'END:VEVENT',
  ]
  return lines.join(ICS_LINE_ENDING)
}

/** Build a full VCALENDAR document containing one VEVENT per festival. */
export function buildIcsCalendar(festivals: IcsFestival[]): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Goodraves//Festival Calendar//EN',
    'CALSCALE:GREGORIAN',
    ...festivals.map(buildEvent),
    'END:VCALENDAR',
  ]
  return lines.join(ICS_LINE_ENDING)
}

/** Trigger a browser download of an .ics file. Client-only. */
export function downloadIcsFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
