import { useState, useCallback } from 'react'
import FestivalCard from '../components/FestivalCard'
import { searchFestivals } from '../api/ticketmaster'
import { searchEvents as searchEdmtrain, HAS_EDMTRAIN_KEY } from '../api/edmtrain'
import { useUserData } from '../context/UserDataContext'

const HAS_TM_KEY = import.meta.env.VITE_TICKETMASTER_KEY &&
  import.meta.env.VITE_TICKETMASTER_KEY !== 'your_ticketmaster_api_key_here'

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  )
}

export default function Home() {
  const [inputValue, setInputValue] = useState('')
  const [query, setQuery] = useState('')
  const { raEvents } = useUserData()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [pageInfo, setPageInfo] = useState(null)
  const [searched, setSearched] = useState(false)
  const [tmPage, setTmPage] = useState(0)
  const [tmHasMore, setTmHasMore] = useState(false)

  const doSearch = useCallback(async (q, p = 0) => {
    if (!q.trim()) return
    setLoading(true)
    setError(null)
    try {
      const results = []

      // Search EDMTrain
      if (HAS_EDMTRAIN_KEY) {
        try {
          const edmResult = await searchEdmtrain({ keyword: q })
          results.push(...edmResult.events)
        } catch (err) {
          console.warn('EDMTrain search failed:', err.message)
        }
      }

      // Search Ticketmaster
      if (HAS_TM_KEY) {
        try {
          const tmResult = await searchFestivals({ keyword: q, page: p, size: 20 })
          results.push(...tmResult.events)
          if (p === 0) {
            setTmHasMore(tmResult.page && tmResult.page.totalPages > 1)
          } else {
            setTmHasMore(tmResult.page && p + 1 < tmResult.page.totalPages)
          }
          setPageInfo(tmResult.page)
        } catch (err) {
          console.warn('Ticketmaster search failed:', err.message)
        }
      }

      // Search local RA Events (always available)
      const queryLower = q.toLowerCase()
      const raResults = Object.values(raEvents).filter(ev => {
        const matchTitle = ev.name.toLowerCase().includes(queryLower)
        const matchLineup = ev.lineup?.some(a => a.toLowerCase().includes(queryLower))
        const matchVenue = ev.venue?.name?.toLowerCase().includes(queryLower)
        const matchCity = ev.venue?.city?.toLowerCase().includes(queryLower)
        return matchTitle || matchLineup || matchVenue || matchCity
      })
      results.push(...raResults)

      // Sort by date
      const sorted = results.sort((a, b) => {
        if (!a.date) return 1
        if (!b.date) return -1
        return a.date.localeCompare(b.date)
      })

      const totalFromAll = sorted.length + (pageInfo?.totalElements ?? 0)
      if (p === 0) {
        setPageInfo(prev => ({ ...prev, totalElements: sorted.length }))
      }

      setEvents(p === 0 ? sorted : prev => [...prev, ...sorted])
      setSearched(true)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [raEvents])

  const handleSubmit = (e) => {
    e.preventDefault()
    setTmPage(0)
    setTmHasMore(false)
    setQuery(inputValue)
    doSearch(inputValue, 0)
  }

  const loadMore = () => {
    const nextPage = tmPage + 1
    setTmPage(nextPage)
    doSearch(query, nextPage)
  }

  return (
    <div className="page">
      <div className="hero">
        <div className="hero-badge">🎵 Goodraves</div>
        <h1>Discover &amp; Track Your Festivals</h1>
        <p>Search for music festivals and electronic events, mark which ones you attended, and keep track of every artist you've seen.</p>
      </div>

      <div className="container">
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
              {events.map(event => (
                <FestivalCard key={event.id} event={event} />
              ))}
            </div>

            {tmHasMore && (
              <div style={{ textAlign: 'center', marginTop: '32px' }}>
                <button
                  id="load-more-btn"
                  className="btn btn-secondary"
                  onClick={loadMore}
                  disabled={loading}
                >
                  {loading ? 'Loading…' : 'Load more'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
