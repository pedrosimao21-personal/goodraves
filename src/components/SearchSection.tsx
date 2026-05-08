'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import FestivalCard from '@/components/FestivalCard'
import { searchFestivalsDB } from '@/db/actions/festivals'

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  )
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
      const results: any[] = []

      try {
        const dbResults = await searchFestivalsDB(q)
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
      } catch (err) {
        console.warn('DB search failed:', err)
      }

      const sorted = results.sort((a, b) => {
        if (!a.date) return 1
        if (!b.date) return -1
        return a.date.localeCompare(b.date)
      })

      setPageInfo({ totalElements: sorted.length })
      setEvents(sorted)
      setSearched(true)
    } catch (err) {
      setError(err as Error)
    } finally {
      setLoading(false)
    }
  }, [])

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
              placeholder="Search festivals, DJs, venues, cities…"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              autoComplete="off"
            />
          </div>
          <button id="search-submit-btn" type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Searching…' : 'Search'}
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
