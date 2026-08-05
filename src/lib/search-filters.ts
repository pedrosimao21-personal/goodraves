export type DateYearOption = string // e.g. "2025", "2026"
export type CountryCodeOption = string // ISO-2, e.g. "NL", "DE"
/** Whether a festival's date is still ahead ("upcoming") or already gone ("past"). */
export type TimingOption = 'upcoming' | 'past'

export interface SearchFilters {
  year: DateYearOption | null
  country: CountryCodeOption | null
  timing: TimingOption | null
}

export interface FilterOption {
  value: string
  label: string
  count: number
}

export interface FilterOptions {
  years: FilterOption[]
  countries: FilterOption[]
  timings: FilterOption[]
}

export const EMPTY_FILTERS: SearchFilters = {
  year: null,
  country: null,
  timing: null,
}

export function hasActiveFilters(filters: SearchFilters): boolean {
  return filters.year !== null || filters.country !== null || filters.timing !== null
}
