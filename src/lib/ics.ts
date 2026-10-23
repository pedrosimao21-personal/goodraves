import { addDays } from './dates'
import { SITE_URL } from './site'

const ICS_LINE_ENDING = '\r\n'
const MINUTES_PER_DAY = 1440
const MINUTES_PER_HOUR = 60

export type IcsFestival = {
  id: string
  name: string
  date: string
  endDate?: string | null
  venueName?: string | null
  location?: string | null
}

/** One timed set. Minutes are on the festival day's axis (1500 = 01:00 the next day). */
export type IcsSet = {
  uid: string
  title: string
  date: string
  startMinutes: number
  endMinutes: number
  location?: string | null
  festivalId: string
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

/**
 * "YYYYMMDDTHHMMSS" with no zone: a floating time, which calendar apps show in
 * the device's local time. Slot times carry no zone either, so this keeps
 * them as printed on the timetable.
 */
function toIcsDateTime(isoDate: string, minutesOnAxis: number): string {
  const day = addDays(isoDate, Math.floor(minutesOnAxis / MINUTES_PER_DAY))
  const minutes = minutesOnAxis % MINUTES_PER_DAY
  const hh = String(Math.floor(minutes / MINUTES_PER_HOUR)).padStart(2, '0')
  const mm = String(minutes % MINUTES_PER_HOUR).padStart(2, '0')
  return `${toIcsDate(day)}T${hh}${mm}00`
}

function buildSetEvent(set: IcsSet): string {
  const lines = [
    'BEGIN:VEVENT',
    `UID:${set.uid}@goodraves`,
    `SUMMARY:${escapeIcsText(set.title)}`,
    `DTSTART:${toIcsDateTime(set.date, set.startMinutes)}`,
    `DTEND:${toIcsDateTime(set.date, set.endMinutes)}`,
    ...(set.location ? [`LOCATION:${escapeIcsText(set.location)}`] : []),
    `URL:${SITE_URL}/festival/${set.festivalId}`,
    'END:VEVENT',
  ]
  return lines.join(ICS_LINE_ENDING)
}

function buildEvent(festival: IcsFestival): string {
  // All-day DTEND is exclusive per RFC 5545 — the day *after* the last day
  // of the event, even for a single-day festival (endDate falls back to date).
  const dtEnd = toIcsDate(addDays(festival.endDate || festival.date, 1))
  const location = [festival.venueName, festival.location].filter(Boolean).join(', ')
  const url = `${SITE_URL}/festival/${festival.id}`

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

function wrapCalendar(events: string[]): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Goodraves//Festival Calendar//EN',
    'CALSCALE:GREGORIAN',
    ...events,
    'END:VCALENDAR',
  ]
  return lines.join(ICS_LINE_ENDING)
}

/** Build a full VCALENDAR document containing one VEVENT per festival. */
export function buildIcsCalendar(festivals: IcsFestival[]): string {
  return wrapCalendar(festivals.map(buildEvent))
}

/** Build a VCALENDAR document with one timed VEVENT per set. */
export function buildIcsSetsCalendar(sets: IcsSet[]): string {
  return wrapCalendar(sets.map(buildSetEvent))
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
