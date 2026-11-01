'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import FestivalCard from '@/components/FestivalCard'
import { type SearchFilters as SearchFiltersType, EMPTY_FILTERS } from '@/lib/search-filters'
import {
  extractFilterOptions,
  applyFilters,
  parseFiltersFromParams,
  buildFilterParams,
} from '@/lib/filter-utils'
import { dismissKeyboard } from '@/lib/touch-tap'
import SearchForm from './SearchForm'
import DiscoverHome from './DiscoverHome'
import SearchFilters, { type DropdownKey } from './SearchFilters'
import { hasSourceImageLookup, isPastResult } from './search-results'
import { useFestivalSearch } from './use-festival-search'
import { useFriendsGoing } from './use-friends-going'
import { ImportStatus, LoadingGrid, NoResults, SearchError, SourceWarning, StartPrompt } from './SearchStates'
import styles from './Discover.module.css'

export default function SearchSection() {
  const searchParams = useSearchParams()
  const initialQuery = searchParams.get('q') ?? ''

  const [inputValue, setInputValue] = useState(initialQuery)
  // The query being searched and shown. Submits don't navigate (see
  // handleSubmit), so after mount this is the only source of the active query.
  const [activeQuery, setActiveQuery] = useState(initialQuery)
  const [filters, setFilters] = useState<SearchFiltersType>(() => parseFiltersFromParams(searchParams))
  const [openDropdown, setOpenDropdown] = useState<DropdownKey | null>(null)
  const { events, searched, loading, error, failedSources, doSearch, clearResults } = useFestivalSearch()

  const eventIds = useMemo(() => events.map((event) => event.id as string), [events])
  const friendsGoing = useFriendsGoing(eventIds)
  const friendsEventCount = useMemo(() => eventIds.filter((id) => friendsGoing[id]?.length > 0).length, [eventIds, friendsGoing])
  const filterOptions = useMemo(() => extractFilterOptions(events), [events])
  const filteredEvents = useMemo(() => applyFilters(events, filters, friendsGoing), [events, filters, friendsGoing])
  // The list is already ordered upcoming-then-past (sortUpcomingThenPast); the
  // split only adds the heading between the two groups.
  const upcomingEvents = useMemo(() => filteredEvents.filter((event) => !isPastResult(event)), [filteredEvents])
  const pastEvents = useMemo(() => filteredEvents.filter(isPastResult), [filteredEvents])
  const hasBothGroups = upcomingEvents.length > 0 && pastEvents.length > 0

  // Mirrors the query and filters into the address bar for sharing. This uses
  // history.replaceState, not router.replace: a router navigation re-renders
  // the page and remounts this component, which would drop the results.
  useEffect(() => {
    const params = buildFilterParams(new URLSearchParams(activeQuery ? { q: activeQuery } : {}), filters)
    window.history.replaceState({}, '', `/?${params.toString()}`)
  }, [filters, activeQuery])

  const handleFilterChange = useCallback((next: SearchFiltersType) => {
    setFilters(next)
    setOpenDropdown(null)
  }, [])

  const handleDropdownToggle = useCallback((key: DropdownKey) => {
    setOpenDropdown((prev) => (prev === key ? null : key))
  }, [])

  const handleDropdownClose = useCallback(() => setOpenDropdown(null), [])

  // Search on mount for a deep link. Typed searches call doSearch directly
  // from the submit handler, not through an effect on activeQuery.
  useEffect(() => {
    if (initialQuery) doSearch(initialQuery)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Back/forward between searches: submits pushState instead of navigating,
  // so the browser history has to be replayed here.
  useEffect(() => {
    function handlePopState() {
      const params = new URLSearchParams(window.location.search)
      const q = params.get('q') ?? ''
      setInputValue(q)
      setActiveQuery(q)
      setFilters(parseFiltersFromParams(params))
      if (q) doSearch(q)
      else clearResults()
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const q = inputValue.trim()
    if (!q) return
    clearResults()
    // A new query starts without the old search's filters; the URL below carries none.
    setFilters(EMPTY_FILTERS)
    setOpenDropdown(null)
    setActiveQuery(q)
    // keepKeyboardOpenOnTap held focus so the tap could land; close the
    // keyboard now so it doesn't cover the results.
    dismissKeyboard()
    // doSearch starts its first server action before its first await, so the
    // request is in flight before pushState runs.
    doSearch(q)
    window.history.pushState({}, '', `/?${new URLSearchParams({ q }).toString()}`)
  }

  const isImporting = loading && events.length === 0 && !error
  const hasNoResults = !loading && searched && filteredEvents.length === 0 && !error

  return (
    <>
      <SearchForm value={inputValue} onChange={setInputValue} onSubmit={handleSubmit} isLoading={loading} />

      <section className={styles.results}>
        {searched && events.length > 0 && (
          <SearchFilters
            filterOptions={filterOptions}
            activeFilters={filters}
            onFilterChange={handleFilterChange}
            totalCount={events.length}
            filteredCount={filteredEvents.length}
            friendsEventCount={friendsEventCount}
            openDropdown={openDropdown}
            onDropdownToggle={handleDropdownToggle}
            onDropdownClose={handleDropdownClose}
          />
        )}

        {failedSources.length > 0 && !loading && (
          <SourceWarning sources={failedSources} onRetry={() => doSearch(activeQuery)} />
        )}
        {error && <SearchError message={error.message} />}
        {isImporting && <ImportStatus query={activeQuery} />}
        {isImporting && <LoadingGrid />}
        {hasNoResults && (
          <NoResults
            query={activeQuery}
            filters={filters}
            hasHiddenResults={events.length > 0}
            onFilterChange={handleFilterChange}
          />
        )}
        {!searched && !loading && (
          <>
            <DiscoverHome />
            <StartPrompt />
          </>
        )}

        {upcomingEvents.length > 0 && (
          <div className={styles.grid}>
            {upcomingEvents.map((event) => (
              // The search resolves images for these results itself, so the
              // card skips its own lookup for them.
              <FestivalCard key={event.id} event={event} skipImageFetch={hasSourceImageLookup(event.id)} friendsGoing={friendsGoing[event.id]} />
            ))}
          </div>
        )}

        {pastEvents.length > 0 && (
          <>
            <h2 className={`mono ${styles.pastHeading} ${upcomingEvents.length === 0 ? styles.pastHeadingFirst : ''}`}>
              {upcomingEvents.length === 0 && <>No upcoming festivals · </>}
              Past festivals <span>{pastEvents.length}</span>
            </h2>
            <div className={styles.grid}>
              {pastEvents.map((event) => (
                <FestivalCard
                  key={event.id}
                  event={event}
                  skipImageFetch={hasSourceImageLookup(event.id)}
                  friendsGoing={friendsGoing[event.id]}
                  shouldMutePast={hasBothGroups}
                />
              ))}
            </div>
          </>
        )}
      </section>
    </>
  )
}
