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
