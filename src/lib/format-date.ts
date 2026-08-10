import { parseLocalDate } from './dates'

const DATE_TBA = 'Date TBA'

type DateFormatPreset = 'short' | 'long' | 'timeline'

const FORMAT_OPTIONS: Record<DateFormatPreset, Intl.DateTimeFormatOptions> = {
  short: { month: 'short', day: 'numeric', year: 'numeric' },
  long: { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' },
  timeline: { weekday: 'short', month: 'long', day: 'numeric' },
}

export function formatDate(
  dateStr: string | undefined | null,
  preset: DateFormatPreset = 'short'
): string {
  if (!dateStr) return DATE_TBA
  const d = parseLocalDate(dateStr)
  return d.toLocaleDateString('en-US', FORMAT_OPTIONS[preset])
}

/**
 * Formats a single date, or a compact range when `endDate` is a distinct
 * later date (e.g. a merged multi-day festival) — "Jul 10 – 12, 2026" when
 * both ends share a month/year, else two full dates joined by an en dash.
 */
export function formatDateRange(
  dateStr: string | undefined | null,
  endDateStr: string | undefined | null,
  preset: DateFormatPreset = 'short'
): string {
  if (!dateStr) return DATE_TBA
  if (!endDateStr || endDateStr === dateStr) return formatDate(dateStr, preset)

  const start = parseLocalDate(dateStr)
  const end = parseLocalDate(endDateStr)
  const sameMonth = start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()

  if (sameMonth) {
    const month = start.toLocaleDateString('en-US', { month: preset === 'long' ? 'long' : 'short' })
    return `${month} ${start.getDate()} – ${end.getDate()}, ${start.getFullYear()}`
  }

  return `${formatDate(dateStr, preset)} – ${formatDate(endDateStr, preset)}`
}

const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS
const WEEK_MS = 7 * DAY_MS

/** "2h ago", "3d ago", falling back to a plain date once it's a week or older. */
export function formatRelativeTime(isoDateTime: string): string {
  const diffMs = Date.now() - new Date(isoDateTime).getTime()
  if (diffMs < MINUTE_MS) return 'just now'
  if (diffMs < HOUR_MS) return `${Math.floor(diffMs / MINUTE_MS)}m ago`
  if (diffMs < DAY_MS) return `${Math.floor(diffMs / HOUR_MS)}h ago`
  if (diffMs < WEEK_MS) return `${Math.floor(diffMs / DAY_MS)}d ago`
  return new Date(isoDateTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
