'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  searchFestivalsDB,
  searchRAEvents,
  searchFFEvents,
  searchPFEvents,
} from '@/db/actions/festivals'
import { importFromUrl } from './search-url-import'
import {
  type SearchResult,
  type SearchSource,
  appendUnique,
  buildResultKey,
  collectSourceIds,
  fetchMissingImages,
  mapDbResult,
  mapFfResult,
  mapPfResult,
  mapRaResult,
  sortUpcomingThenPast,
} from './search-results'

/**
 * Runs a Discover search: imports a pasted event link, or searches our DB and
 * the three live sources. A source that fails is reported in `failedSources`
 * and the others still show.
 */
export function useFestivalSearch() {
  const router = useRouter()
  const [events, setEvents] = useState<SearchResult[]>([])
  const [searched, setSearched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [failedSources, setFailedSources] = useState<SearchSource[]>([])

  const searchSources = useCallback(async (q: string) => {
    async function fetchFrom<T>(source: SearchSource, fetcher: () => Promise<T[]>): Promise<T[]> {
      try {
        return await fetcher()
      } catch {
        setFailedSources((prev) => [...prev, source])
        return []
      }
    }

    // `results` mirrors what's on screen so the image pass at the end sees the
    // full merged set without reading React state.
    const results: SearchResult[] = []
    const publish = () => setEvents(sortUpcomingThenPast(results))

    // DB results paint as soon as they land. The live sources are each a
    // scrape, and Next runs client-triggered server actions one at a time, so
    // each is merged in and painted when it resolves (priority DB > PF > RA > FF).
    const dbRows = await fetchFrom('db', () => searchFestivalsDB(q))
    results.push(...dbRows.map(mapDbResult))
    const keys = new Set(results.map(buildResultKey))
    publish()
    setSearched(true)

    const dbPfIds = collectSourceIds(dbRows, 'partyflock')
    const pfRows = await fetchFrom('partyflock', () => searchPFEvents(q))
    appendUnique(results, keys, pfRows.filter((pf) => pf.date && !dbPfIds.has(pf.pfId)).map(mapPfResult))
    publish()

    const dbRaIds = collectSourceIds(dbRows, 'ra')
    const raRows = await fetchFrom('ra', () => searchRAEvents(q))
    appendUnique(results, keys, raRows.filter((ra) => !dbRaIds.has(ra.raId)).map(mapRaResult))
    publish()

    const dbFfSlugs = collectSourceIds(dbRows, 'festivalfans')
    const ffRows = await fetchFrom('festivalfans', () => searchFFEvents(q))
    appendUnique(results, keys, ffRows.filter((ff) => ff.date && !dbFfSlugs.has(ff.ffSlug)).map(mapFfResult))
    publish()

    fetchMissingImages(results).then((images) => {
      if (images.size === 0) return
      setEvents((prev) => prev.map((e) => (images.has(e.id) ? { ...e, image: images.get(e.id) } : e)))
    })
  }, [])

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) return
    setLoading(true)
    setError(null)
    setFailedSources([])
    // Filters are not reset here: this also runs for a deep link like
    // "/?q=X&year=2026", whose filters must survive. A new typed query resets
    // them in the submit handler instead.
    try {
      const imported = await importFromUrl(q)
      if (imported && 'festivalId' in imported) {
        router.push(`/festival/${imported.festivalId}`)
        return
      }
      if (imported && 'error' in imported) {
        setError(new Error(imported.error))
        setSearched(true)
        return
      }
      await searchSources(q)
    } catch (err) {
      setError(err as Error)
    } finally {
      setLoading(false)
    }
  }, [router, searchSources])

  const clearResults = useCallback(() => {
    setEvents([])
    setSearched(false)
  }, [])

  return { events, searched, loading, error, failedSources, doSearch, clearResults }
}
