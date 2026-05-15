'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import FestivalCard from '@/components/FestivalCard'
import { searchFestivalsDB, searchRAEvents, fetchRAEvent, searchFFEvents, fetchFFEvent, fetchFFEventImageUrl, fetchRAEventImageUrl, searchPFEvents, fetchPFEvent, fetchPFEventImageUrl } from '@/db/actions/festivals'
import { resolvePFEventSlug } from '@/services/partyflock/client'

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  )
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

export default function SearchSection() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialQuery = searchParams.get('q') ?? ''

  const [inputValue, setInputValue] = useState(initialQuery)
  const [events, setEvents] = useState<any[]>([])
  const [searched, setSearched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [pageInfo, setPageInfo] = useState<any>(null)

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) return
    setLoading(true)
    setError(null)
    try {
      // Check if the input is an RA event URL
      const raEventId = extractRAEventId(q)
      if (raEventId) {
        const festivalId = await fetchRAEvent(raEventId)
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
        const festivalId = await fetchFFEvent(ffSlug)
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
          pfPartyId = await resolvePFEventSlug(pfSlug)
        }
      }
      if (pfPartyId) {
        const festivalId = await fetchPFEvent(pfPartyId)
        if (festivalId) {
          router.push(`/festival/${festivalId}`)
          return
        } else {
          setError(new Error('Could not fetch event from Partyflock.nl. The event may not exist or the site may be unavailable.'))
          setSearched(true)
          return
        }
      }

      const results: any[] = []

      // Search DB, RA, FestivalFans, and Partyflock in parallel
      const [dbResults, raResults, ffResults, pfResults] = await Promise.all([
        searchFestivalsDB(q).catch((err) => { console.warn('DB search failed:', err); return [] }),
        searchRAEvents(q).catch((err) => { console.warn('RA search failed:', err); return [] }),
        searchFFEvents(q).catch((err) => { console.warn('FF search failed:', err); return [] }),
        searchPFEvents(q).catch((err) => { console.warn('PF search failed:', err); return [] }),
      ])

      // Add DB results first
      const mapped = dbResults.map((f: any) => ({
        id: f.id,
        name: f.name,
        date: f.date,
        venue: f.venue ? { name: f.venue, city: f.location ?? '' } : undefined,
        location: f.location,
        lineup: [],
        source: f.source ?? 'ra',
        image: f.imageUrl,
      }))
      results.push(...mapped)

      // Build a set of name+date keys from DB results to deduplicate across all sources
      const existingKeys = new Set(
        results.map((r: any) => `${r.name?.toLowerCase()}::${r.date ?? ''}`)
      )

      // Collect RA source IDs already in DB results to deduplicate
      const dbRaIds = new Set(
        dbResults
          .filter((f: any) => f.source === 'ra' && f.sourceId)
          .map((f: any) => String(f.sourceId))
      )

      // Add RA results that aren't already in DB results (by sourceId or name+date)
      for (const ra of raResults) {
        if (dbRaIds.has(ra.raId)) continue
        const key = `${ra.name?.toLowerCase()}::${ra.date ?? ''}`
        if (existingKeys.has(key)) continue
        existingKeys.add(key)
        results.push({
          id: `ra-${ra.raId}`,
          name: ra.name,
          date: ra.date,
          venue: ra.venue ? { name: ra.venue, city: ra.location ?? '' } : undefined,
          location: ra.location,
          lineup: [],
          source: 'ra',
          image: ra.imageUrl,
          _fromRA: true,
        })
      }

      // Collect FF slugs already in DB results to deduplicate
      const dbFFSlugs = new Set(
        dbResults
          .filter((f: any) => f.source === 'festivalfans' && f.sourceId)
          .map((f: any) => String(f.sourceId))
      )

      // Add FF results that aren't already in DB or exact duplicates (same name + date)
      for (const ff of ffResults) {
        if (!ff.date) continue
        if (dbFFSlugs.has(ff.ffSlug)) continue
        if (existingKeys.has(`${ff.name?.toLowerCase()}::${ff.date ?? ''}`)) continue
        existingKeys.add(`${ff.name?.toLowerCase()}::${ff.date ?? ''}`)
        results.push({
          id: `ff-${ff.ffSlug}`,
          name: ff.name,
          date: ff.date,
          venue: ff.venue ? { name: ff.venue, city: ff.location ?? '' } : undefined,
          location: ff.location,
          lineup: [],
          source: 'festivalfans',
          image: ff.imageUrl,
          _fromFF: true,
        })
      }

      // Collect PF IDs already in DB results to deduplicate
      const dbPFIds = new Set(
        dbResults
          .filter((f: any) => f.source === 'partyflock' && f.sourceId)
          .map((f: any) => String(f.sourceId))
      )

      // Add PF results that aren't already in DB or exact duplicates (same name + date)
      for (const pf of pfResults) {
        if (!pf.date) continue
        if (dbPFIds.has(pf.pfId)) continue
        if (existingKeys.has(`${pf.name?.toLowerCase()}::${pf.date ?? ''}`)) continue
        existingKeys.add(`${pf.name?.toLowerCase()}::${pf.date ?? ''}`)
        results.push({
          id: `pf-${pf.pfId}`,
          name: pf.name,
          date: pf.date,
          venue: pf.venue ? { name: pf.venue, city: pf.location ?? '' } : undefined,
          location: pf.location,
          lineup: [],
          source: 'partyflock',
          image: pf.imageUrl,
          _fromPF: true,
        })
      }

      const sorted = results.sort((a, b) => {
        if (!a.date) return 1
        if (!b.date) return -1
        return b.date.localeCompare(a.date)
      })

      setPageInfo({ totalElements: sorted.length })
      setEvents(sorted)
      setSearched(true)

      // Lazily fetch images for FF results that don't have one
      const ffWithoutImage = sorted.filter(
        (e: any) => !e.image && e.id?.startsWith('ff-')
      )
      for (const ff of ffWithoutImage) {
        const slug = ff.id.replace(/^ff-/, '')
        fetchFFEventImageUrl(slug).then((imageUrl) => {
          if (!imageUrl) return
          setEvents((prev) =>
            prev.map((e) => (e.id === ff.id ? { ...e, image: imageUrl } : e))
          )
        }).catch(() => { /* image fetch failed, tile stays without image */ })
      }

      // Lazily fetch images for RA results that don't have one
      const raWithoutImage = sorted.filter(
        (e: any) => !e.image && e.id?.startsWith('ra-')
      )
      for (const ra of raWithoutImage) {
        const raId = ra.id.replace(/^ra-/, '')
        fetchRAEventImageUrl(raId).then((imageUrl) => {
          if (!imageUrl) return
          setEvents((prev) =>
            prev.map((e) => (e.id === ra.id ? { ...e, image: imageUrl } : e))
          )
        }).catch(() => { /* image fetch failed, tile stays without image */ })
      }

      // Lazily fetch images for PF results that don't have one
      const pfWithoutImage = sorted.filter(
        (e: any) => !e.image && e.id?.startsWith('pf-')
      )
      for (const pf of pfWithoutImage) {
        const pfPartyId = pf.id.replace(/^pf-/, '')
        fetchPFEventImageUrl(pfPartyId).then((imageUrl) => {
          if (!imageUrl) return
          setEvents((prev) =>
            prev.map((e) => (e.id === pf.id ? { ...e, image: imageUrl } : e))
          )
        }).catch(() => { /* image fetch failed, tile stays without image */ })
      }
    } catch (err) {
      setError(err as Error)
    } finally {
      setLoading(false)
    }
  }, [router])

  // Trigger search on mount (or when URL ?q= changes) without pushing a new history entry
  useEffect(() => {
    if (initialQuery) {
      doSearch(initialQuery)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const q = inputValue.trim()
    if (!q) return
    setEvents([])
    setSearched(false)
    // Update URL param — this causes the component to re-read initialQuery via the effect
    const params = new URLSearchParams()
    params.set('q', q)
    router.push(`/?${params.toString()}`)
  }

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
          <button id="search-submit-btn" type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? ((extractRAEventId(inputValue) || extractFFSlugLocal(inputValue) || extractPFPartyIdLocal(inputValue) || extractPFEventSlugLocal(inputValue)) ? 'Fetching event…' : 'Searching…') : 'Search'}
          </button>
        </form>
      </div>

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

      {!loading && searched && events.length === 0 && !error && (
        <div className="empty-state">
          <div className="empty-state-icon">🔍</div>
          <h3>No events found</h3>
          <p>Try a different search — artist name, venue, city or festival.</p>
        </div>
      )}

      {!searched && !loading && (
        <div className="empty-state">
          <div className="empty-state-icon">🎪</div>
          <h3>Ready to explore?</h3>
          <p>Search for your favourite festival, DJ or city above to get started.</p>
        </div>
      )}

      {events.length > 0 && (
        <>
          <div className="section-header">
            <h2 className="section-title">Results</h2>
            {pageInfo && (
              <span className="section-count">
                {events.length} events found
              </span>
            )}
          </div>

          <div className="grid">
            {events.map((event: any) => (
              <FestivalCard key={event.id} event={event} />
            ))}
          </div>
        </>
      )}
    </>
  )
}
