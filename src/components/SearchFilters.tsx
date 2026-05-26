'use client'

import { useEffect, useRef, useCallback } from 'react'
import {
  type SearchFilters,
  type FilterOptions,
  type FilterOption,
  type DateRangeOption,
  hasActiveFilters,
  EMPTY_FILTERS,
} from '@/lib/search-filters'

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

// ── Hooks ──────────────────────────────────────────────

function useClickOutside(ref: React.RefObject<HTMLElement | null>, onClose: () => void) {
  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [ref, onClose])
}

// ── Date Dropdown ──────────────────────────────────────

interface DateDropdownProps {
  options: FilterOption[]
  selected: DateRangeOption | null
  isOpen: boolean
  onToggle: () => void
  onClose: () => void
  onSelect: (value: DateRangeOption | null) => void
}

function DateDropdown({ options, selected, isOpen, onToggle, onClose, onSelect }: DateDropdownProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  useClickOutside(containerRef, onClose)

  const handleSelect = useCallback((value: DateRangeOption) => {
    // Clicking an already-selected option deselects it
    onSelect(selected === value ? null : value)
    onClose()
  }, [selected, onSelect, onClose])

  const selectedLabel = options.find((o) => o.value === selected)?.label ?? null

  return (
    <div className="filter-dropdown" ref={containerRef}>
      <button
        type="button"
        className={`filter-dropdown-trigger${selected ? ' is-active' : ''}${isOpen ? ' is-open' : ''}`}
        onClick={onToggle}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        {selectedLabel ? `Date: ${selectedLabel}` : 'Date'}
        <ChevronIcon />
      </button>

      {isOpen && (
        <div className="filter-dropdown-menu" role="listbox" aria-label="Date range filter">
          {options.map((option) => (
            <label key={option.value} className="filter-option">
              <input
                type="radio"
                name="date-range"
                checked={selected === option.value}
                onChange={() => handleSelect(option.value as DateRangeOption)}
              />
              <span className="filter-option-label">{option.label}</span>
              <span className="filter-option-count">{option.count}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Country Dropdown ───────────────────────────────────

interface CountryDropdownProps {
  options: FilterOption[]
  selected: string[]
  isOpen: boolean
  onToggle: () => void
  onClose: () => void
  onToggleCountry: (country: string) => void
}

function CountryDropdown({
  options,
  selected,
  isOpen,
  onToggle,
  onClose,
  onToggleCountry,
}: CountryDropdownProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  useClickOutside(containerRef, onClose)

  const selectedSet = new Set(selected)
  const triggerLabel =
    selected.length === 0
      ? 'Country'
      : selected.length === 1
        ? `Country: ${selected[0]}`
        : `Country: ${selected.length} selected`

  return (
    <div className="filter-dropdown" ref={containerRef}>
      <button
        type="button"
        className={`filter-dropdown-trigger${selected.length > 0 ? ' is-active' : ''}${isOpen ? ' is-open' : ''}`}
        onClick={onToggle}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-multiselectable="true"
      >
        {triggerLabel}
        <ChevronIcon />
      </button>

      {isOpen && (
        <div className="filter-dropdown-menu" role="listbox" aria-label="Country filter" aria-multiselectable="true">
          {options.map((option) => (
            <label key={option.value} className="filter-option">
              <input
                type="checkbox"
                checked={selectedSet.has(option.value)}
                onChange={() => onToggleCountry(option.value)}
              />
              <span className="filter-option-label">{option.label}</span>
              <span className="filter-option-count">{option.count}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Active Filter Chips ────────────────────────────────

interface FilterChipsProps {
  filters: SearchFilters
  dateLabel: string | null
  onRemoveDateRange: () => void
  onRemoveCountry: (country: string) => void
}

function FilterChips({ filters, dateLabel, onRemoveDateRange, onRemoveCountry }: FilterChipsProps) {
  const hasChips = filters.dateRange !== null || filters.countries.length > 0
  if (!hasChips) return null

  return (
    <div className="filter-chips" aria-label="Active filters">
      {filters.dateRange !== null && dateLabel && (
        <span className="filter-chip">
          {dateLabel}
          <button
            type="button"
            className="filter-chip-remove"
            onClick={onRemoveDateRange}
            aria-label={`Remove date filter: ${dateLabel}`}
          >
            <CloseIcon />
          </button>
        </span>
      )}
      {filters.countries.map((country) => (
        <span key={country} className="filter-chip">
          {country}
          <button
            type="button"
            className="filter-chip-remove"
            onClick={() => onRemoveCountry(country)}
            aria-label={`Remove country filter: ${country}`}
          >
            <CloseIcon />
          </button>
        </span>
      ))}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────

interface SearchFiltersProps {
  filterOptions: FilterOptions
  activeFilters: SearchFilters
  onFilterChange: (filters: SearchFilters) => void
  totalCount: number
  filteredCount: number
  openDropdown: 'date' | 'country' | null
  onDropdownToggle: (key: 'date' | 'country') => void
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
  const showDateFilter = filterOptions.dateRanges.length > 0
  const showCountryFilter = filterOptions.countries.length > 0

  if (!showDateFilter && !showCountryFilter) return null

  const handleDateSelect = useCallback(
    (value: DateRangeOption | null) => {
      onFilterChange({ ...activeFilters, dateRange: value })
    },
    [activeFilters, onFilterChange],
  )

  const handleToggleCountry = useCallback(
    (country: string) => {
      const isSelected = activeFilters.countries.includes(country)
      const countries = isSelected
        ? activeFilters.countries.filter((c) => c !== country)
        : [...activeFilters.countries, country]
      onFilterChange({ ...activeFilters, countries })
    },
    [activeFilters, onFilterChange],
  )

  const handleRemoveDateRange = useCallback(() => {
    onFilterChange({ ...activeFilters, dateRange: null })
  }, [activeFilters, onFilterChange])

  const handleRemoveCountry = useCallback(
    (country: string) => {
      onFilterChange({
        ...activeFilters,
        countries: activeFilters.countries.filter((c) => c !== country),
      })
    },
    [activeFilters, onFilterChange],
  )

  const activeDateLabel =
    filterOptions.dateRanges.find((o) => o.value === activeFilters.dateRange)?.label ?? null

  return (
    <div className="search-filters">
      <div className="search-filters-row">
        {showDateFilter && (
          <DateDropdown
            options={filterOptions.dateRanges}
            selected={activeFilters.dateRange}
            isOpen={openDropdown === 'date'}
            onToggle={() => onDropdownToggle('date')}
            onClose={onDropdownClose}
            onSelect={handleDateSelect}
          />
        )}
        {showCountryFilter && (
          <CountryDropdown
            options={filterOptions.countries}
            selected={activeFilters.countries}
            isOpen={openDropdown === 'country'}
            onToggle={() => onDropdownToggle('country')}
            onClose={onDropdownClose}
            onToggleCountry={handleToggleCountry}
          />
        )}
        <FilterChips
          filters={activeFilters}
          dateLabel={activeDateLabel}
          onRemoveDateRange={handleRemoveDateRange}
          onRemoveCountry={handleRemoveCountry}
        />
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
