'use client'

import { useEffect, useRef, useCallback } from 'react'
import {
  type SearchFilters,
  type FilterOptions,
  type FilterOption,
  hasActiveFilters,
  EMPTY_FILTERS,
} from '@/lib/search-filters'
import { getCountryFlag } from '@/services/ra/country-flags'

// ── Icons ──────────────────────────────────────────────

function ChevronIcon() {
  return (
    <svg
      className="chevron"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

// ── Click-outside hook ─────────────────────────────────
// Uses 'mousedown' on capture phase so we can check containment
// before the click propagates. Crucially, if the user clicks
// *inside* the ref'd element the handler does nothing, so option
// buttons inside the dropdown always fire their own onClick first.

function useClickOutside(ref: React.RefObject<HTMLElement | null>, onClose: () => void) {
  useEffect(() => {
    // pointerdown (not mousedown): on iOS Safari the synthetic mousedown from
    // a tap can lag behind the real touch by enough to land after an
    // in-between re-render, occasionally misjudging an in-menu tap as
    // outside. pointerdown fires directly from the touch, before any mouse
    // emulation, so it doesn't have that gap.
    function handlePointerDown(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('pointerdown', handlePointerDown, true)
    return () => document.removeEventListener('pointerdown', handlePointerDown, true)
  }, [ref, onClose])
}

// ── Filter Dropdown (shared by Year and Country) ───────

export type DropdownKey = 'year' | 'country' | 'timing'

interface FilterDropdownProps {
  dropdownKey: DropdownKey
  label: string
  ariaLabel: string
  options: FilterOption[]
  selected: string | null
  isOpen: boolean
  onToggle: (key: DropdownKey) => void
  onClose: () => void
  onSelect: (value: string | null) => void
  renderOptionLabel?: (option: FilterOption) => React.ReactNode
}

function FilterDropdown({
  dropdownKey,
  label,
  ariaLabel,
  options,
  selected,
  isOpen,
  onToggle,
  onClose,
  onSelect,
  renderOptionLabel,
}: FilterDropdownProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  useClickOutside(containerRef, onClose)

  const handleOptionClick = useCallback((value: string) => {
    // Clicking the already-selected option deselects it
    onSelect(selected === value ? null : value)
    onClose()
  }, [selected, onSelect, onClose])

  const selectedOption = options.find((o) => o.value === selected)
  const triggerLabel = selectedOption ? `${label}: ${selectedOption.label}` : label

  return (
    <div className="filter-dropdown" ref={containerRef}>
      <button
        type="button"
        className={`filter-dropdown-trigger${selected ? ' is-active' : ''}${isOpen ? ' is-open' : ''}`}
        onClick={() => onToggle(dropdownKey)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        {triggerLabel}
        <ChevronIcon />
      </button>

      {isOpen && (
        <div className="filter-dropdown-menu" role="listbox" aria-label={ariaLabel}>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={selected === option.value}
              className={`filter-option${selected === option.value ? ' is-selected' : ''}`}
              onClick={() => handleOptionClick(option.value)}
            >
              <span className="filter-option-indicator" aria-hidden="true" />
              <span className="filter-option-label">
                {renderOptionLabel ? renderOptionLabel(option) : option.label}
              </span>
              <span className="filter-option-count">{option.count}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function CountryOptionLabel({ option }: { option: FilterOption }) {
  const flag = getCountryFlag(option.value)
  return (
    <>
      {flag && <span className="filter-option-flag" aria-hidden="true">{flag}</span>}
      {option.label}
    </>
  )
}

// ── Main Component ─────────────────────────────────────

interface SearchFiltersProps {
  filterOptions: FilterOptions
  activeFilters: SearchFilters
  onFilterChange: (filters: SearchFilters) => void
  totalCount: number
  filteredCount: number
  openDropdown: DropdownKey | null
  onDropdownToggle: (key: DropdownKey) => void
  onDropdownClose: () => void
}

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

  const handleYearSelect = useCallback(
    (value: string | null) => {
      onFilterChange({ ...activeFilters, year: value })
    },
    [activeFilters, onFilterChange],
  )

  const handleCountrySelect = useCallback(
    (value: string | null) => {
      onFilterChange({ ...activeFilters, country: value })
    },
    [activeFilters, onFilterChange],
  )

  const handleRemoveYear = useCallback(() => {
    onFilterChange({ ...activeFilters, year: null })
  }, [activeFilters, onFilterChange])

  const handleRemoveCountry = useCallback(() => {
    onFilterChange({ ...activeFilters, country: null })
  }, [activeFilters, onFilterChange])

  const handleTimingSelect = useCallback(
    (value: string | null) => {
      onFilterChange({ ...activeFilters, timing: (value as SearchFilters['timing']) ?? null })
    },
    [activeFilters, onFilterChange],
  )

  const handleRemoveTiming = useCallback(() => {
    onFilterChange({ ...activeFilters, timing: null })
  }, [activeFilters, onFilterChange])

  const selectedCountryOption = filterOptions.countries.find((c) => c.value === activeFilters.country)
  const selectedTimingOption = filterOptions.timings.find((t) => t.value === activeFilters.timing)

  // Hooks above must run on every render — keep this early return after them.
  if (
    filterOptions.years.length === 0 &&
    filterOptions.countries.length === 0 &&
    filterOptions.timings.length === 0
  ) return null

  return (
    <div className="search-filters">
      <div className="search-filters-row">
        {filterOptions.timings.length > 0 && (
          <FilterDropdown
            dropdownKey="timing"
            label="When"
            ariaLabel="Upcoming or past filter"
            options={filterOptions.timings}
            selected={activeFilters.timing}
            isOpen={openDropdown === 'timing'}
            onToggle={onDropdownToggle}
            onClose={onDropdownClose}
            onSelect={handleTimingSelect}
          />
        )}

        {filterOptions.years.length > 0 && (
          <FilterDropdown
            dropdownKey="year"
            label="Year"
            ariaLabel="Year filter"
            options={filterOptions.years}
            selected={activeFilters.year}
            isOpen={openDropdown === 'year'}
            onToggle={onDropdownToggle}
            onClose={onDropdownClose}
            onSelect={handleYearSelect}
          />
        )}

        {filterOptions.countries.length > 0 && (
          <FilterDropdown
            dropdownKey="country"
            label="Country"
            ariaLabel="Country filter"
            options={filterOptions.countries}
            selected={activeFilters.country}
            isOpen={openDropdown === 'country'}
            onToggle={onDropdownToggle}
            onClose={onDropdownClose}
            onSelect={handleCountrySelect}
            renderOptionLabel={(option) => <CountryOptionLabel option={option} />}
          />
        )}

        {activeFilters.timing && (
          <span className="filter-chip">
            {selectedTimingOption?.label ?? activeFilters.timing}
            <button
              type="button"
              className="filter-chip-remove"
              onClick={handleRemoveTiming}
              aria-label={`Remove filter: ${selectedTimingOption?.label ?? activeFilters.timing}`}
            >
              <CloseIcon />
            </button>
          </span>
        )}

        {activeFilters.year && (
          <span className="filter-chip">
            {activeFilters.year}
            <button
              type="button"
              className="filter-chip-remove"
              onClick={handleRemoveYear}
              aria-label={`Remove year filter: ${activeFilters.year}`}
            >
              <CloseIcon />
            </button>
          </span>
        )}

        {activeFilters.country && (
          <span className="filter-chip">
            {getCountryFlag(activeFilters.country)} {selectedCountryOption?.label ?? activeFilters.country}
            <button
              type="button"
              className="filter-chip-remove"
              onClick={handleRemoveCountry}
              aria-label={`Remove country filter: ${selectedCountryOption?.label ?? activeFilters.country}`}
            >
              <CloseIcon />
            </button>
          </span>
        )}
      </div>

      {isFiltered && (
        <div className="filter-summary">
          <p className="filter-summary-count">
            Showing <strong>{filteredCount}</strong> of {totalCount} events
          </p>
          <button
            type="button"
            className="filter-clear-btn"
            onClick={() => onFilterChange(EMPTY_FILTERS)}
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  )
}
