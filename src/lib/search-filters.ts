export type DateRangeOption =
  | 'this-week'
  | 'this-month'
  | 'next-3-months'
  | 'next-6-months'
  | 'this-year';

export interface SearchFilters {
  dateRange: DateRangeOption | null;
  countries: string[];
}

export interface FilterOption {
  value: string;
  label: string;
  count: number;
}

export interface FilterOptions {
  countries: FilterOption[];
  dateRanges: FilterOption[];
}

export const EMPTY_FILTERS: SearchFilters = {
  dateRange: null,
  countries: [],
};

export const DATE_RANGE_OPTIONS: DateRangeOption[] = [
  'this-week',
  'this-month',
  'next-3-months',
  'next-6-months',
  'this-year',
];

export const DATE_RANGE_LABELS: Record<DateRangeOption, string> = {
  'this-week': 'This Week',
  'this-month': 'This Month',
  'next-3-months': 'Next 3 Months',
  'next-6-months': 'Next 6 Months',
  'this-year': 'This Year',
};

export function hasActiveFilters(filters: SearchFilters): boolean {
  return filters.dateRange !== null || filters.countries.length > 0;
}
