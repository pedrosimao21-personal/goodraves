'use client'

import { type SearchFilters, EMPTY_FILTERS, hasActiveFilters } from '@/lib/search-filters'
import { WarningIcon } from '@/components/icons'
import { detectUrlSource } from './search-url-import'
import { type SearchSource, SOURCE_NAMES } from './search-results'
import discoverStyles from './Discover.module.css'
import styles from './SearchStates.module.css'

// Discover loading, empty and error states. Board: States / StatesMobile.

const SKELETON_COUNT = 6

/** Card-shaped placeholders, so nothing jumps when results land. */
export function LoadingGrid() {
  return (
    <div className={discoverStyles.grid} aria-busy="true" aria-label="Loading festivals">
      {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
        <div key={i} className={styles.skeletonCard}>
          <div className={`skeleton ${styles.skeletonMedia}`} />
          <div className={styles.skeletonBody}>
            <div className={`skeleton ${styles.skeletonLine}`} />
            <div className={`skeleton ${styles.skeletonTitle}`} />
            <div className={`skeleton ${styles.skeletonLineWide}`} />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Shown while a pasted event link is being imported. */
export function ImportStatus({ query }: { query: string }) {
  const source = detectUrlSource(query)
  if (!source) return null
  return (
    <div className={styles.importStatus} role="status" aria-live="polite">
      <span className={styles.spinner} aria-hidden="true" />
      <span>Importing the event from {source}. This takes about 5 seconds.</span>
    </div>
  )
}

const TIMING_LABELS = { upcoming: 'Upcoming', past: 'Past' } as const

function describeFilters(filters: SearchFilters): string {
  const timing = filters.timing ? TIMING_LABELS[filters.timing] : null
  return [timing, filters.year, filters.country].filter(Boolean).join(', ')
}

interface NoResultsProps {
  query: string
  filters: SearchFilters
  /** The search found events, but the active filters hide all of them. */
  hasHiddenResults: boolean
  onFilterChange: (filters: SearchFilters) => void
}

export function NoResults({ query, filters, hasHiddenResults, onFilterChange }: NoResultsProps) {
  const isFiltered = hasHiddenResults && hasActiveFilters(filters)
  const canSearchPast = isFiltered && filters.timing === 'upcoming'

  return (
    <div className={styles.state}>
      <h2 className={`display ${styles.stateTitle}`}>No festivals match &ldquo;{query}&rdquo;.</h2>
      {isFiltered ? (
        <p className={styles.stateText}>
          Filters are on: <strong className={styles.stateStrong}>{describeFilters(filters)}</strong>.
        </p>
      ) : (
        <p className={styles.stateText}>Try a festival name, DJ, venue or city.</p>
      )}
      {isFiltered && (
        <div className={styles.stateActions}>
          {canSearchPast && (
            <button type="button" className="btn btn-primary" onClick={() => onFilterChange({ ...filters, timing: 'past' })}>
              Show past events
            </button>
          )}
          <button type="button" className="btn" onClick={() => onFilterChange(EMPTY_FILTERS)}>Clear filters</button>
        </div>
      )}
      <p className={styles.stateHint}>Still missing? Paste its RA, FestivalFans or Partyflock link to import it.</p>
    </div>
  )
}

interface SourceWarningProps {
  sources: SearchSource[]
  onRetry: () => void
}

/** One failing source never blanks the page; the others still show. */
export function SourceWarning({ sources, onRetry }: SourceWarningProps) {
  const names = sources.map((source) => SOURCE_NAMES[source]).join(', ')
  return (
    <div className={styles.warning} role="status">
      <WarningIcon size={18} className={styles.warningIcon} />
      <span className={styles.warningText}>{names} did not respond. Showing results from the other sources.</span>
      <button type="button" className="btn btn-sm" onClick={onRetry}>Retry</button>
    </div>
  )
}

export function SearchError({ message }: { message: string }) {
  return (
    <div className={styles.state} role="alert">
      <h2 className={`display ${styles.stateTitle}`}>Something went wrong.</h2>
      <p className={styles.stateText}>{message}</p>
    </div>
  )
}

export function StartPrompt() {
  return (
    <div className={styles.start}>
      <p className="mono">Search to get started</p>
      <p className={styles.stateText}>Look up a festival, a DJ you want to see, a venue or a city.</p>
    </div>
  )
}
