import {
  type DateYearOption,
  type FilterOption,
  type FilterOptions,
  type SearchFilters,
  EMPTY_FILTERS,
} from './search-filters'

// ── Year Extraction ────────────────────────────────────

export function extractYearFromDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null
  const year = dateStr.slice(0, 4)
  return /^\d{4}$/.test(year) ? year : null
}

// ── Filter Option Extraction ───────────────────────────

export function extractFilterOptions(events: any[]): FilterOptions {
  const yearCounts = new Map<string, number>()

  for (const event of events) {
    const year = extractYearFromDate(event.date)
    if (year) {
      yearCounts.set(year, (yearCounts.get(year) ?? 0) + 1)
    }
  }

  const years: FilterOption[] = Array.from(yearCounts.entries())
    .map(([value, count]) => ({ value, label: value, count }))
    .sort((a, b) => b.value.localeCompare(a.value))

  return { years }
}

// ── Filter Application ─────────────────────────────────

export function applyFilters(events: any[], filters: SearchFilters): any[] {
  if (filters.year === null) return events

  return events.filter((e) => extractYearFromDate(e.date) === filters.year)
}

// ── URL Serialisation ──────────────────────────────────

export function parseFiltersFromParams(searchParams: URLSearchParams): SearchFilters {
  const year = searchParams.get('year')
  const isValidYear = year !== null && /^\d{4}$/.test(year)
  return { year: isValidYear ? year : null }
}

export function buildFilterParams(
  baseParams: URLSearchParams,
  filters: SearchFilters,
): URLSearchParams {
  const params = new URLSearchParams(baseParams)

  if (filters.year) {
    params.set('year', filters.year)
  } else {
    params.delete('year')
  }

  return params
}

export { EMPTY_FILTERS }
export type { DateYearOption }
