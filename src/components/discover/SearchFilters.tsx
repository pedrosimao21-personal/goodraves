'use client'

import { useCallback } from 'react'
import {
  type SearchFilters as SearchFiltersType,
  type FilterOptions,
  hasActiveFilters,
  EMPTY_FILTERS,
} from '@/lib/search-filters'
import FilterDropdown, { type DropdownKey } from './FilterDropdown'
import styles from './SearchFilters.module.css'

export type { DropdownKey }

interface SearchFiltersProps {
  filterOptions: FilterOptions
  activeFilters: SearchFiltersType
  onFilterChange: (filters: SearchFiltersType) => void
  totalCount: number
  filteredCount: number
  openDropdown: DropdownKey | null
  onDropdownToggle: (key: DropdownKey) => void
  onDropdownClose: () => void
}

/** Filter bar above the results: When / Year / Country, Clear, and the count. */
export default function SearchFilters({
  filterOptions,
  activeFilters,
  onFilterChange,
  totalCount,
  filteredCount,
  openDropdown,
  onDropdownToggle,
  onDropdownClose,
}: SearchFiltersProps) {
  const isFiltered = hasActiveFilters(activeFilters)

  const selectFilter = useCallback(
    (key: DropdownKey) => (value: string | null) => {
      onFilterChange({ ...activeFilters, [key]: value })
    },
    [activeFilters, onFilterChange],
  )

  const sharedProps = { onToggle: onDropdownToggle, onClose: onDropdownClose }
  const count = isFiltered ? `${filteredCount} of ${totalCount} events` : `${totalCount} events`

  return (
    <div className={styles.bar}>
      {filterOptions.timings.length > 0 && (
        <FilterDropdown
          {...sharedProps}
          dropdownKey="timing"
          label="When"
          ariaLabel="Upcoming or past filter"
          options={filterOptions.timings}
          selected={activeFilters.timing}
          isOpen={openDropdown === 'timing'}
          onSelect={selectFilter('timing')}
        />
      )}
      {filterOptions.years.length > 0 && (
        <FilterDropdown
          {...sharedProps}
          dropdownKey="year"
          label="Year"
          ariaLabel="Year filter"
          options={filterOptions.years}
          selected={activeFilters.year}
          isOpen={openDropdown === 'year'}
          onSelect={selectFilter('year')}
        />
      )}
      {filterOptions.countries.length > 0 && (
        <FilterDropdown
          {...sharedProps}
          dropdownKey="country"
          label="Country"
          ariaLabel="Country filter"
          options={filterOptions.countries}
          selected={activeFilters.country}
          isOpen={openDropdown === 'country'}
          onSelect={selectFilter('country')}
        />
      )}
      {isFiltered && (
        <button type="button" className={`btn btn-sm btn-ghost ${styles.clear}`} onClick={() => onFilterChange(EMPTY_FILTERS)}>
          Clear
        </button>
      )}
      <span className={`mono ${styles.count}`} aria-live="polite">{count} · by date</span>
    </div>
  )
}
