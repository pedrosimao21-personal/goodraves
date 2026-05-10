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
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', FORMAT_OPTIONS[preset])
}
