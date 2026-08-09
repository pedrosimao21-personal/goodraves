'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import FestivalCard from '@/components/FestivalCard'
import SearchFilters, { type DropdownKey } from '@/components/SearchFilters'
import {
  searchFestivalsDB,
  searchRAEvents,
  fetchRAEvent,
  searchFFEvents,
  fetchFFEvent,
  fetchFFEventImageUrl,
  fetchRAEventImageUrl,
  searchPFEvents,
  fetchPFEvent,
  fetchPFEventImageUrl,
  resolvePartyflockSlug,
} from '@/db/actions/festivals'
import { type SearchFilters as SearchFiltersType, EMPTY_FILTERS } from '@/lib/search-filters'
import {
  extractFilterOptions,
  applyFilters,
  parseFiltersFromParams,
  buildFilterParams,
} from '@/lib/filter-utils'
import { keepKeyboardOpenOnTap, dismissKeyboard } from '@/lib/touch-tap'

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  )
}

/**
 * ID prefixes whose missing image doSearch resolves itself, in the enrichment
 * pass at the end of the search. Cards for these must skip their own image
 * lookup — otherwise every imageless result costs two requests instead of one.
 * Other results (custom-, external DB rows) are not covered by that pass and
 * still rely on the card's own fallback lookup.
 */
const SOURCE_IMAGE_ID_PREFIXES = ['ra-', 'ff-', 'pf-']

function hasSourceImageLookup(eventId: string): boolean {
  return SOURCE_IMAGE_ID_PREFIXES.some((prefix) => eventId.startsWith(prefix))
}

/** Extract an RA event ID from a ra.co URL, or return null */
function extractRAEventId(input: string): string | null {
  const match = input.match(/ra\.co\/events\/(\d+)/)
  return match ? match[1] : null
}

/** Extract a FestivalFans slug from a festivalfans.nl URL, or return null */
function extractFFSlugLocal(input: string): string | null {
  const match = input.match(/festivalfans\.nl\/event\/([a-z0-9-]+)/i)
  return match ? match[1] : null
}

/** Extract a Partyflock party ID from a partyflock.nl URL, or return null */
function extractPFPartyIdLocal(input: string): string | null {
  const match = input.match(/partyflock\.nl\/party\/(\d+)/)
  return match ? match[1] : null
}

/** Extract a Partyflock event slug from a /event/ URL, or return null */
function extractPFEventSlugLocal(input: string): string | null {
  const match = input.match(/partyflock\.nl\/event\/([a-z0-9-]+)/i)
  return match ? match[1] : null
}

function isUrlInput(input: string): boolean {
  return !!(
    extractRAEventId(input) ||
    extractFFSlugLocal(input) ||
    extractPFPartyIdLocal(input) ||
    extractPFEventSlugLocal(input)
  )
}

export default function SearchSection() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialQuery = searchParams.get('q') ?? ''

  const [inputValue, setInputValue] = useState(initialQuery)
  // The query actually being searched/displayed. Kept as its own state instead
  // of reading `initialQuery` everywhere, because a submit no longer navigates
  // (see handleSubmit) — this is the only source of truth for "what query is
  // active" once the page has mounted.
  const [activeQuery, setActiveQuery] = useState(initialQuery)
  const [events, setEvents] = useState<any[]>([])
  const [searched, setSearched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // Filters
  const [filters, setFilters] = useState<SearchFiltersType>(() =>
    parseFiltersFromParams(searchParams)
  )
  const [openDropdown, setOpenDropdown] = useState<DropdownKey | null>(null)

  // Derived — computed only when events or filters change
  const filterOptions = useMemo(() => extractFilterOptions(events), [events])
  const filteredEvents = useMemo(() => applyFilters(events, filters), [events, filters])

  // Sync filter changes back to the URL for deep-linking/sharing.
  //
  // Uses history.replaceState, NOT router.replace: the latter is a real App
  // Router navigation that re-fetches this route's RSC payload and re-renders
  // page.tsx -> <Suspense><SearchSection/></Suspense>, remounting this
  // component and resetting `events` to []. The search then re-ran and the
  // freshly-filtered list was discarded — which is why applying a filter
  // appeared to do nothing. history.replaceState updates the address bar
  // without any navigation, so filter state survives.
  //
  // Depends on `activeQuery`, not the initial-mount `initialQuery` — reading
  // the latter here was the actual "click Search twice" bug: handleSubmit
  // used to call router.push(`/?q=...`) and this effect ran in the same tick
  // off a still-stale `initialQuery` closure, so it immediately replaceState'd
  // the URL back to before the query was added, cancelling the navigation.
  useEffect(() => {
    const baseParams = new URLSearchParams()
    if (activeQuery) baseParams.set('q', activeQuery)
    const params = buildFilterParams(baseParams, filters)
    window.history.replaceState({}, '', `/?${params.toString()}`)
  }, [filters, activeQuery])

  const handleFilterChange = useCallback((next: SearchFiltersType) => {
    setFilters(next)
    setOpenDropdown(null)
  }, [])

  const handleDropdownToggle = useCallback((key: DropdownKey) => {
    setOpenDropdown((prev) => (prev === key ? null : key))
  }, [])

  const handleDropdownClose = useCallback(() => {
    setOpenDropdown(null)
  }, [])

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) return
    setLoading(true)
    setError(null)
    // Filters are NOT reset here — this same function also runs for the
    // initial mount / a deep link (e.g. "/?q=X&year=2026"), and resetting
    // unconditionally threw away the year/country the URL asked to restore.
    // A genuinely new user-initiated query resets filters in handleSubmit
    // instead, right where its filter-free URL is built.
    try {
      // Check if the input is an RA event URL
      const raEventId = extractRAEventId(q)
      if (raEventId) {
        const festivalId = await fetchRAEvent(raEventId, { force: true })
        if (festivalId) {
          router.push(`/festival/${festivalId}`)
          return
        } else {
          setError(new Error('Could not fetch event from Resident Advisor. The event may not exist or RA may be unavailable.'))
          setSearched(true)
          return
        }
      }

      // Check if the input is a FestivalFans.nl event URL
      const ffSlug = extractFFSlugLocal(q)
      if (ffSlug) {
        const festivalId = await fetchFFEvent(ffSlug, { force: true })
        if (festivalId) {
          router.push(`/festival/${festivalId}`)
          return
        } else {
          setError(new Error('Could not fetch event from FestivalFans.nl. The event may not exist or the site may be unavailable.'))
          setSearched(true)
          return
        }
      }

      // Check if the input is a Partyflock.nl event URL (/party/ID or /event/slug)
      let pfPartyId = extractPFPartyIdLocal(q)
      if (!pfPartyId) {
        const pfSlug = extractPFEventSlugLocal(q)
        if (pfSlug) {
          pfPartyId = await resolvePartyflockSlug(pfSlug)
        }
      }
      if (pfPartyId) {
        const festivalId = await fetchPFEvent(pfPartyId, { force: true })
        if (festivalId) {
          router.push(`/festival/${festivalId}`)
          return
        } else {
          setError(new Error('Could not fetch event from Partyflock.nl. The event may not exist or the site may be unavailable.'))
          setSearched(true)
          return
        }
      }

      // `results` mirrors what's on screen so the image-enrichment pass at the
      // end can see the full merged set without re-reading React state.
      const results: any[] = []
      const sortByDateDesc = (list: any[]) =>
        [...list].sort((a, b) => {
          if (!a.date) return 1
          if (!b.date) return -1
          return b.date.localeCompare(a.date)
        })

      // Paint DB results as soon as they land instead of waiting on the three
      // external scrapes too — DB is a single fast Neon round trip, while RA/
      // FestivalFans/Partyflock are each a live fetch, and Next's server
      // action queue runs client-triggered actions one at a time (not in
      // parallel), so a single Promise.all here would make first paint wait
      // on whichever scrape is slowest. Each source below is merged in and
      // painted the moment it resolves.
      let dbResults: any[] = []
      try {
        dbResults = await searchFestivalsDB(q)
      } catch (err) {
        console.warn('DB search failed:', err)
      }

      const mapped = dbResults.map((f: any) => ({
        id: f.id,
        name: f.name,
        date: f.date,
        endDate: f.endDate,
        venue: f.venue ? { name: f.venue, city: f.location ?? '' } : undefined,
        location: f.location,
        countryCode: f.countryCode,
        countryName: f.countryName,
        lineup: [],
        source: f.source ?? 'ra',
        image: f.imageUrl,
        genres: f.genres ?? [],
      }))
      results.push(...mapped)

      // Build a set of name+date keys from DB results to deduplicate across all sources
      const existingKeys = new Set(
        results.map((r: any) => `${r.name?.toLowerCase()}::${r.date ?? ''}`)
      )

      // Collect per-source ids already in DB results, so a live scrape result
      // for something already imported doesn't render as a second card.
      const dbPFIds = new Set(
        dbResults
          .filter((f: any) => f.source === 'partyflock' && f.sourceId)
          .map((f: any) => String(f.sourceId))
      )
      const dbRaIds = new Set(
        dbResults
          .filter((f: any) => f.source === 'ra' && f.sourceId)
          .map((f: any) => String(f.sourceId))
      )
      const dbFFSlugs = new Set(
        dbResults
          .filter((f: any) => f.source === 'festivalfans' && f.sourceId)
          .map((f: any) => String(f.sourceId))
      )

      setEvents(sortByDateDesc(results))
      setSearched(true)
      // Not setLoading(false) yet — the three scrapes below are still in
      // flight and the search button should keep reflecting that.

      // Partyflock next (existing dedup priority: DB > PF > RA > FF)
      try {
        const pfResults = await searchPFEvents(q)
        for (const pf of pfResults) {
          if (!pf.date) continue
          if (dbPFIds.has(pf.pfId)) continue
          const key = `${pf.name?.toLowerCase()}::${pf.date ?? ''}`
          if (existingKeys.has(key)) continue
          existingKeys.add(key)
          results.push({
            id: `pf-${pf.pfId}`,
            name: pf.name,
            date: pf.date,
            venue: pf.venue ? { name: pf.venue, city: pf.location ?? '' } : undefined,
            location: pf.location,
            // Partyflock search results carry a city only, no country — this
            // relies on the best-effort location-string derivation in
            // filter-utils.ts (documented limitation, see location-normalizer.ts).
            lineup: [],
            source: 'partyflock',
            image: pf.imageUrl,
            _fromPF: true,
          })
        }
        setEvents(sortByDateDesc(results))
      } catch (err) {
        console.warn('PF search failed:', err)
      }

      // Resident Advisor next
      try {
        const raResults = await searchRAEvents(q)
        for (const ra of raResults) {
          if (dbRaIds.has(ra.raId)) continue
          const key = `${ra.name?.toLowerCase()}::${ra.date ?? ''}`
          if (existingKeys.has(key)) continue
          existingKeys.add(key)
          results.push({
            id: `ra-${ra.raId}`,
            name: ra.name,
            date: ra.date,
            endDate: ra.endDate,
            venue: ra.venue ? { name: ra.venue, city: ra.location ?? '' } : undefined,
            location: ra.location,
            countryCode: ra.countryCode,
            countryName: ra.country,
            lineup: [],
            source: 'ra',
            image: ra.imageUrl,
            _fromRA: true,
          })
        }
        setEvents(sortByDateDesc(results))
      } catch (err) {
        console.warn('RA search failed:', err)
      }

      // FestivalFans last
      try {
        const ffResults = await searchFFEvents(q)
        for (const ff of ffResults) {
          if (!ff.date) continue
          if (dbFFSlugs.has(ff.ffSlug)) continue
          const key = `${ff.name?.toLowerCase()}::${ff.date ?? ''}`
          if (existingKeys.has(key)) continue
          existingKeys.add(key)
          results.push({
            id: `ff-${ff.ffSlug}`,
            name: ff.name,
            date: ff.date,
            venue: ff.venue ? { name: ff.venue, city: ff.location ?? '' } : undefined,
            location: ff.location,
            countryCode: ff.countryCode,
            countryName: ff.countryName,
            lineup: [],
            source: 'festivalfans',
            image: ff.imageUrl,
            _fromFF: true,
          })
        }
        setEvents(sortByDateDesc(results))
      } catch (err) {
        console.warn('FF search failed:', err)
      }

      // Batch image fetches: collect all resolved images then apply a single state update
      const sorted = results
      const imagePromises: Promise<{ id: string; imageUrl: string } | null>[] = []

      // FF results without images
      const ffWithoutImage = sorted.filter(
        (e: any) => !e.image && e.id?.startsWith('ff-')
      )
      for (const ff of ffWithoutImage) {
        const slug = ff.id.replace(/^ff-/, '')
        imagePromises.push(
          fetchFFEventImageUrl(slug)
            .then((imageUrl) => imageUrl ? { id: ff.id, imageUrl } : null)
            .catch(() => null)
        )
      }

      // RA results without images
      const raWithoutImage = sorted.filter(
        (e: any) => !e.image && e.id?.startsWith('ra-')
      )
      for (const ra of raWithoutImage) {
        const raId = ra.id.replace(/^ra-/, '')
        imagePromises.push(
          fetchRAEventImageUrl(raId)
            .then((imageUrl) => imageUrl ? { id: ra.id, imageUrl } : null)
            .catch(() => null)
        )
      }

      // PF results without images
      const pfWithoutImage = sorted.filter(
        (e: any) => !e.image && e.id?.startsWith('pf-')
      )
      for (const pf of pfWithoutImage) {
        const pfId = pf.id.replace(/^pf-/, '')
        imagePromises.push(
          fetchPFEventImageUrl(pfId)
            .then((imageUrl) => imageUrl ? { id: pf.id, imageUrl } : null)
            .catch(() => null)
        )
      }

      // Apply all resolved images in a single batch update
      if (imagePromises.length > 0) {
        Promise.allSettled(imagePromises).then((results) => {
          const imageMap = new Map<string, string>()
          for (const result of results) {
            if (result.status === 'fulfilled' && result.value) {
              imageMap.set(result.value.id, result.value.imageUrl)
            }
          }
          if (imageMap.size > 0) {
            setEvents((prev) =>
              prev.map((e) => {
                const img = imageMap.get(e.id)
                return img ? { ...e, image: img } : e
              })
            )
          }
        })
      }
    } catch (err) {
      setError(err as Error)
    } finally {
      setLoading(false)
    }
  }, [router])

  // Trigger search on mount and whenever activeQuery changes
  useEffect(() => {
    if (activeQuery) {
      doSearch(activeQuery)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeQuery])

  // Searching used to be a real navigation (router.push), which round-tripped
  // to the server for a route that renders nothing but this client component
  // — an extra RSC fetch on every mobile search for no benefit, and the
  // source of the double-tap bug above. A plain pushState keeps the URL
  // shareable/deep-linkable without any of that.
  useEffect(() => {
    function handlePopState() {
      const params = new URLSearchParams(window.location.search)
      const q = params.get('q') ?? ''
      setInputValue(q)
      setActiveQuery(q)
      setFilters(parseFiltersFromParams(params))
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const q = inputValue.trim()
    if (!q) return
    setEvents([])
    setSearched(false)
    // A genuinely new query resets filters from the old search — this is the
    // one place that should, since the URL below carries no year/country.
    setFilters(EMPTY_FILTERS)
    setOpenDropdown(null)
    // keepKeyboardOpenOnTap held focus so this tap could land; now that it has,
    // close the keyboard so it isn't covering the results.
    dismissKeyboard()
    const params = new URLSearchParams()
    params.set('q', q)
    window.history.pushState({}, '', `/?${params.toString()}`)
    // Re-submitting the query that's already active leaves activeQuery
    // unchanged, so the effect above never fires and the tap would do
    // nothing. Search directly in that case (the effect covers every
    // genuinely changed query).
    if (q === activeQuery) {
      doSearch(q)
    } else {
      setActiveQuery(q)
    }
  }

  // Not gated on `!loading` — DB results (and their filters) should appear as
  // soon as they paint, without waiting for the still-in-flight RA/FF/PF scrapes.
  const showFilters = searched && events.length > 0

  return (
    <>
      <div className="search-wrap">
        <form className="search-form" onSubmit={handleSubmit} id="festival-search-form">
          <div className="search-input-wrap">
            <SearchIcon />
            <input
              id="festival-search-input"
              className="search-input"
              type="text"
              placeholder="Search festivals, DJs, venues, cities or paste an RA/FestivalFans/Partyflock URL…"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              autoComplete="off"
            />
          </div>
          <button id="search-submit-btn" type="submit" className="btn btn-primary" disabled={loading} onPointerDown={keepKeyboardOpenOnTap}>
            {loading ? (isUrlInput(inputValue) ? 'Fetching event…' : 'Searching…') : 'Search'}
          </button>
        </form>
      </div>

      {showFilters && (
        <SearchFilters
          filterOptions={filterOptions}
          activeFilters={filters}
          onFilterChange={handleFilterChange}
          totalCount={events.length}
          filteredCount={filteredEvents.length}
          openDropdown={openDropdown}
          onDropdownToggle={handleDropdownToggle}
          onDropdownClose={handleDropdownClose}        />
      )}

      {error && (
        <div className="error-state">
          <div className="error-state-icon">🚫</div>
          <h3>Something went wrong</h3>
          <p>{error.message}</p>
        </div>
      )}

      {loading && events.length === 0 && (
        <div className="grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton skeleton-card" />
          ))}
        </div>
      )}

      {!loading && searched && filteredEvents.length === 0 && !error && (
        <div className="empty-state">
          <div className="empty-state-icon">🔍</div>
          <h3>No events found</h3>
          <p>
            {events.length > 0
              ? 'No events match the active filters. Try adjusting or clearing them.'
              : 'Try a different search — artist name, venue, city or festival.'}
          </p>
        </div>
      )}

      {!searched && !loading && (
        <div className="empty-state">
          <div className="empty-state-icon">🎪</div>
          <h3>Ready to explore?</h3>
          <p>Search for your favourite festival, DJ or city above to get started.</p>
        </div>
      )}

      {filteredEvents.length > 0 && (
        <>
          <div className="section-header">
            <h2 className="section-title">Results</h2>
            <span className="section-count">
              {filteredEvents.length} events found
            </span>
          </div>

          <div className="grid">
            {filteredEvents.map((event: any) => (
              // doSearch resolves the image for these results itself, so the
              // card must not fire its own duplicate lookup for them.
              <FestivalCard key={event.id} event={event} skipImageFetch={hasSourceImageLookup(event.id)} />
            ))}
          </div>
        </>
      )}
    </>
  )
}
