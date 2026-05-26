export type DateYearOption = string // e.g. "2025", "2026"

export interface SearchFilters {
  year: DateYearOption | null
}

export interface FilterOption {
  value: string
  label: string
  count: number
}

export interface FilterOptions {
  years: FilterOption[]
}

export const EMPTY_FILTERS: SearchFilters = {
  year: null,
}

export function hasActiveFilters(filters: SearchFilters): boolean {
  return filters.year !== null
}
