'use client'

import { useEffect, useRef, useCallback } from 'react'
import type { FilterOption } from '@/lib/search-filters'
import { CheckIcon, ChevronDownIcon } from '@/components/icons'
import styles from './SearchFilters.module.css'

export type DropdownKey = 'year' | 'country' | 'timing'

/**
 * Closes the open dropdown on a pointer press outside it or on Escape. Only
 * the open dropdown listens: every dropdown shares one `openDropdown` state,
 * so a closed one reacting would close the open one before its option's
 * click lands. pointerdown fires straight from the touch on iOS Safari,
 * before an in-between re-render can misjudge an in-menu tap as outside.
 */
function useDismiss(ref: React.RefObject<HTMLElement | null>, isOpen: boolean, onClose: () => void) {
  useEffect(() => {
    if (!isOpen) return

    function handlePointerDown(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose()
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('pointerdown', handlePointerDown, true)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [ref, isOpen, onClose])
}

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
}

export default function FilterDropdown({
  dropdownKey,
  label,
  ariaLabel,
  options,
  selected,
  isOpen,
  onToggle,
  onClose,
  onSelect,
}: FilterDropdownProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  useDismiss(containerRef, isOpen, onClose)

  const handleOptionClick = useCallback((value: string) => {
    // Picking the selected option again clears the filter.
    onSelect(selected === value ? null : value)
    onClose()
  }, [selected, onSelect, onClose])

  const selectedOption = options.find((o) => o.value === selected)

  return (
    <div className={styles.dropdown} ref={containerRef}>
      <button
        type="button"
        className={`btn btn-sm ${styles.trigger} ${selected ? styles.triggerActive : ''}`}
        onClick={() => onToggle(dropdownKey)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className={styles.triggerLabel}>{label}</span>
        {selectedOption && <span>{selectedOption.label}</span>}
        <ChevronDownIcon size={14} strokeWidth={2} className={isOpen ? styles.chevronOpen : undefined} />
      </button>

      {isOpen && (
        <div className={styles.menu} role="listbox" aria-label={ariaLabel}>
          {options.map((option) => {
            const isSelected = selected === option.value
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={`${styles.option} ${isSelected ? styles.optionSelected : ''}`}
                onClick={() => handleOptionClick(option.value)}
              >
                <span className={styles.optionCheck} aria-hidden="true">
                  {isSelected && <CheckIcon size={16} strokeWidth={2} />}
                </span>
                <span className={styles.optionLabel}>{option.label}</span>
                <span className={`mono ${styles.optionCount}`}>{option.count}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
