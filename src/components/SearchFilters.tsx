'use client'

import { useEffect, useRef, useCallback } from 'react'
import {
  type SearchFilters,
  type FilterOptions,
  type FilterOption,
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

// ── Click-outside hook ─────────────────────────────────
// Uses 'mousedown' on capture phase so we can check containment
// before the click propagates. Crucially, if the user clicks
// *inside* the ref'd element the handler does nothing, so option
// buttons inside the dropdown always fire their own onClick first.

function useClickOutside(ref: React.RefObject<HTMLElement | null>, onClose: () => void) {
  useEffect(() => {
    function handleMouseDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleMouseDown, true)
    return () => document.removeEventListener('mousedown', handleMouseDown, true)
  }, [ref, onClose])
}

// ── Year Dropdown ──────────────────────────────────────

interface YearDropdownProps {
  options: FilterOption[]
  selected: string | null
  isOpen: boolean
  onToggle: () => void
  onClose: () => void
  onSelect: (value: string | null) => void
}

function YearDropdown({ options, selected, isOpen, onToggle, onClose, onSelect }: YearDropdownProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  useClickOutside(containerRef, onClose)

  const handleOptionClick = useCallback((value: string) => {
    // Clicking the already-selected year deselects it
    onSelect(selected === value ? null : value)
    onClose()
  }, [selected, onSelect, onClose])

  const triggerLabel = selected ? `Year: ${selected}` : 'Year'

  return (
    <div className="filter-dropdown" ref={containerRef}>
      <button
        type="button"
        className={`filter-dropdown-trigger${selected ? ' is-active' : ''}${isOpen ? ' is-open' : ''}`}
        onClick={onToggle}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        {triggerLabel}
        <ChevronIcon />
      </button>

      {isOpen && (
        <div className="filter-dropdown-menu" role="listbox" aria-label="Year filter">
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
              <span className="filter-option-label">{option.label}</span>
              <span className="filter-option-count">{option.count}</span>
            </button>
          ))}
        </div>
      )}
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
  openDropdown: 'year' | null
  onDropdownToggle: (key: 'year') => void
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

  const handleRemoveYear = useCallback(() => {
    onFilterChange({ ...activeFilters, year: null })
  }, [activeFilters, onFilterChange])

  // Hooks above must run on every render — keep this early return after them.
  if (filterOptions.years.length === 0) return null

  return (
    <div className="search-filters">
      <div className="search-filters-row">
        <YearDropdown
          options={filterOptions.years}
          selected={activeFilters.year}
          isOpen={openDropdown === 'year'}
          onToggle={() => onDropdownToggle('year')}
          onClose={onDropdownClose}
          onSelect={handleYearSelect}
        />

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
