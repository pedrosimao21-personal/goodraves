export type DateYearOption = string // e.g. "2025", "2026"
export type CountryCodeOption = string // ISO-2, e.g. "NL", "DE"

export interface SearchFilters {
  year: DateYearOption | null
  country: CountryCodeOption | null
}

export interface FilterOption {
  value: string
  label: string
  count: number
}

export interface FilterOptions {
  years: FilterOption[]
  countries: FilterOption[]
}

export const EMPTY_FILTERS: SearchFilters = {
  year: null,
  country: null,
}

export function hasActiveFilters(filters: SearchFilters): boolean {
  return filters.year !== null || filters.country !== null
}
