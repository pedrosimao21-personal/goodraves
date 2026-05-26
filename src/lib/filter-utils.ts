import {
  type DateRangeOption,
  type FilterOption,
  type FilterOptions,
  type SearchFilters,
  DATE_RANGE_OPTIONS,
  DATE_RANGE_LABELS,
  EMPTY_FILTERS,
} from './search-filters';

// ── Country Extraction ─────────────────────────────────

export function extractCountryFromLocation(location: string | null | undefined): string | null {
  if (!location) return null;
  const segments = location.split(',').map((s) => s.trim()).filter(Boolean);
  if (segments.length === 0) return null;
  return segments[segments.length - 1];
}

// ── Date Range Logic ───────────────────────────────────

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

export function isDateInRange(dateStr: string | null | undefined, range: DateRangeOption): boolean {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return false;

  const now = new Date();
  // Normalise to start of today to avoid time-of-day skew
  now.setHours(0, 0, 0, 0);

  switch (range) {
    case 'this-week':
      return date >= now && date <= addDays(now, 7);
    case 'this-month':
      return (
        date >= now &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear()
      );
    case 'next-3-months':
      return date >= now && date <= addMonths(now, 3);
    case 'next-6-months':
      return date >= now && date <= addMonths(now, 6);
    case 'this-year':
      return date >= now && date.getFullYear() === now.getFullYear();
  }
}

// ── Filter Option Extraction ───────────────────────────

export function extractFilterOptions(events: any[]): FilterOptions {
  const countryCounts = new Map<string, number>();

  for (const event of events) {
    const country = extractCountryFromLocation(event.location);
    if (country) {
      countryCounts.set(country, (countryCounts.get(country) ?? 0) + 1);
    }
  }

  const countries: FilterOption[] = Array.from(countryCounts.entries())
    .map(([value, count]) => ({ value, label: value, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  const dateRanges: FilterOption[] = DATE_RANGE_OPTIONS
    .map((range) => ({
      value: range,
      label: DATE_RANGE_LABELS[range],
      count: events.filter((e) => isDateInRange(e.date, range)).length,
    }))
    .filter((option) => option.count > 0);

  return { countries, dateRanges };
}

// ── Filter Application ─────────────────────────────────

export function applyFilters(events: any[], filters: SearchFilters): any[] {
  let result = events;

  if (filters.dateRange !== null) {
    result = result.filter((e) => isDateInRange(e.date, filters.dateRange!));
  }

  if (filters.countries.length > 0) {
    const selectedSet = new Set(filters.countries);
    result = result.filter((e) => {
      const country = extractCountryFromLocation(e.location);
      return country !== null && selectedSet.has(country);
    });
  }

  return result;
}

// ── URL Serialisation ──────────────────────────────────

export function parseFiltersFromParams(searchParams: URLSearchParams): SearchFilters {
  const dateRangeParam = searchParams.get('dateRange') as DateRangeOption | null;
  const isValidDateRange =
    dateRangeParam !== null &&
    (DATE_RANGE_OPTIONS as string[]).includes(dateRangeParam);

  const countriesParam = searchParams.get('countries');
  const countries = countriesParam
    ? countriesParam.split(',').map((c) => c.trim()).filter(Boolean)
    : [];

  return {
    dateRange: isValidDateRange ? dateRangeParam : null,
    countries,
  };
}

export function buildFilterParams(
  baseParams: URLSearchParams,
  filters: SearchFilters,
): URLSearchParams {
  const params = new URLSearchParams(baseParams);

  if (filters.dateRange) {
    params.set('dateRange', filters.dateRange);
  } else {
    params.delete('dateRange');
  }

  if (filters.countries.length > 0) {
    params.set('countries', filters.countries.join(','));
  } else {
    params.delete('countries');
  }

  return params;
}

export { EMPTY_FILTERS };
