import {
  type DateYearOption,
  type CountryCodeOption,
  type TimingOption,
  type FilterOption,
  type FilterOptions,
  type SearchFilters,
  EMPTY_FILTERS,
} from './search-filters'
import { extractCountryFromLocation, getCountryIsoCode, getCountryNameFromIsoCode } from '@/utils/location-normalizer'
import { isFestivalPast } from './festival-date'

/** Ordered so the dropdown always lists Upcoming before Past. */
const TIMING_LABELS: { value: TimingOption; label: string }[] = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'past', label: 'Past' },
]

function isValidTiming(value: string | null): value is TimingOption {
  return value === 'upcoming' || value === 'past'
}

/** An event's timing bucket, or null when it has no usable date. */
function extractTiming(event: { date?: string | null }): TimingOption | null {
  if (!event.date) return null
  return isFestivalPast(event.date) ? 'past' : 'upcoming'
}

// ── Year Extraction ────────────────────────────────────

export function extractYearFromDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null
  const year = dateStr.slice(0, 4)
  return /^\d{4}$/.test(year) ? year : null
}

// ── Country Extraction ─────────────────────────────────

/**
 * Resolves an ISO-2 country code for a search-result event. DB-sourced
 * events carry a real `countryCode` column; live scrape results (RA/FF/PF)
 * mostly don't, so this falls back to a best-effort derivation from the
 * "City, Country" `location` string — which is unavailable or unreliable for
 * a meaningful share of results (see location-normalizer.ts), a documented
 * limitation rather than a bug.
 */
export function extractCountryCode(event: { countryCode?: string | null; location?: string | null }): string | null {
  if (event.countryCode) return event.countryCode
  const rawCountry = extractCountryFromLocation(event.location)
  return rawCountry ? getCountryIsoCode(rawCountry) : null
}

// ── Filter Option Extraction ───────────────────────────

export function extractFilterOptions(events: any[]): FilterOptions {
  const yearCounts = new Map<string, number>()
  const countryCounts = new Map<string, { label: string; count: number }>()
  const timingCounts = new Map<TimingOption, number>()

  for (const event of events) {
    const year = extractYearFromDate(event.date)
    if (year) {
      yearCounts.set(year, (yearCounts.get(year) ?? 0) + 1)
    }

    const code = extractCountryCode(event)
    if (code) {
      const existing = countryCounts.get(code)
      const label = event.countryName ?? existing?.label ?? getCountryNameFromIsoCode(code) ?? code
      countryCounts.set(code, { label, count: (existing?.count ?? 0) + 1 })
    }

    const timing = extractTiming(event)
    if (timing) {
      timingCounts.set(timing, (timingCounts.get(timing) ?? 0) + 1)
    }
  }

  const years: FilterOption[] = Array.from(yearCounts.entries())
    .map(([value, count]) => ({ value, label: value, count }))
    .sort((a, b) => b.value.localeCompare(a.value))

  const countries: FilterOption[] = Array.from(countryCounts.entries())
    .map(([value, { label, count }]) => ({ value, label, count }))
    .sort((a, b) => b.count - a.count)

  // Fixed Upcoming-then-Past order (not count-sorted) so the control doesn't
  // reshuffle as results stream in.
  const timings: FilterOption[] = TIMING_LABELS
    .filter(({ value }) => (timingCounts.get(value) ?? 0) > 0)
    .map(({ value, label }) => ({ value, label, count: timingCounts.get(value) ?? 0 }))

  return { years, countries, timings }
}

// ── Filter Application ─────────────────────────────────

export function applyFilters(events: any[], filters: SearchFilters): any[] {
  return events.filter((e) => {
    if (filters.year !== null && extractYearFromDate(e.date) !== filters.year) return false
    if (filters.country !== null && extractCountryCode(e) !== filters.country) return false
    if (filters.timing !== null && extractTiming(e) !== filters.timing) return false
    return true
  })
}

// ── URL Serialisation ──────────────────────────────────

export function parseFiltersFromParams(searchParams: URLSearchParams): SearchFilters {
  const year = searchParams.get('year')
  const isValidYear = year !== null && /^\d{4}$/.test(year)
  const country = searchParams.get('country')
  const timing = searchParams.get('timing')
  return {
    year: isValidYear ? year : null,
    country: country ? country.toUpperCase() : null,
    timing: isValidTiming(timing) ? timing : null,
  }
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

  if (filters.country) {
    params.set('country', filters.country)
  } else {
    params.delete('country')
  }

  if (filters.timing) {
    params.set('timing', filters.timing)
  } else {
    params.delete('timing')
  }

  return params
}

export { EMPTY_FILTERS }
export type { DateYearOption, CountryCodeOption, TimingOption }
