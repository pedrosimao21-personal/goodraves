import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUserData } from '../context/UserDataContext'

const MONTHS = [
  'All', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function formatDate(dateStr) {
  if (!dateStr) return 'Date TBA'
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric' })
}

export default function Timeline() {
  const navigate = useNavigate()
  const { attendedFestivals, festivalMeta, seenArtists, artistMeta, artistRatings } = useUserData()

  // Build a list of attended festivals with metadata
  const festivals = useMemo(() => {
    return attendedFestivals
      .map(id => {
        const meta = festivalMeta[id]
        const date = meta?.date ?? null
        const year = date ? new Date(date + 'T00:00:00').getFullYear() : null
        const month = date ? new Date(date + 'T00:00:00').getMonth() + 1 : null
        const seen = (seenArtists[id] ?? []).map(aid => ({
          id: aid,
          name: artistMeta[aid]?.name ?? aid,
          image: artistMeta[aid]?.image ?? null,
          rating: artistRatings[aid] ?? 0,
        }))
        return { id, meta, year, month, seen }
      })
      .filter(f => f.meta)
      .sort((a, b) => {
        if (a.meta.date && b.meta.date) return a.meta.date.localeCompare(b.meta.date)
        return 0
      })
  }, [attendedFestivals, festivalMeta, seenArtists, artistMeta, artistRatings])

  // Get available years
  const years = useMemo(() => {
    const yrs = [...new Set(festivals.map(f => f.year).filter(Boolean))].sort((a, b) => b - a)
    return yrs.length > 0 ? yrs : [new Date().getFullYear()]
  }, [festivals])

  const [selectedYear, setSelectedYear] = useState(years[0] ?? new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState('All')

  // Filter by year + month
  const filtered = useMemo(() => {
    return festivals.filter(f => {
      if (f.year !== selectedYear) return false
      if (selectedMonth !== 'All' && f.month !== MONTHS.indexOf(selectedMonth)) return false
      return true
    })
  }, [festivals, selectedYear, selectedMonth])

  return (
    <div className="page">
      <div className="container">
        <div style={{ paddingTop: 8, marginBottom: 32 }}>
          <h1 className="section-title" style={{ fontSize: '2rem', fontFamily: 'var(--font-display)', fontWeight: 800, marginBottom: 6 }}>
            Timeline
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Your festival history by year and month
          </p>
        </div>

        {/* Year selector */}
        <div className="filters" style={{ marginBottom: 16 }}>
          <span className="filter-label">Year:</span>
          <div className="filter-chips">
            {years.map(y => (
              <button
                key={y}
                className={`chip ${selectedYear === y ? 'active' : ''}`}
                onClick={() => setSelectedYear(y)}
                id={`year-${y}`}
              >
                {y}
              </button>
            ))}
          </div>
        </div>

        {/* Month selector */}
        <div className="filters" style={{ marginBottom: 32 }}>
          <span className="filter-label">Month:</span>
          <div className="filter-chips">
            {MONTHS.map(m => (
              <button
                key={m}
                className={`chip ${selectedMonth === m ? 'active' : ''}`}
                onClick={() => setSelectedMonth(m)}
                id={`month-${m.toLowerCase()}`}
              >
                {m === 'All' ? 'All months' : m.slice(0, 3)}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📅</div>
            <h3>No festivals in this period</h3>
            <p>
              {attendedFestivals.length === 0
                ? 'You haven\'t marked any festivals as attended yet. Head to Discover!'
                : `No attended festivals found for ${selectedMonth !== 'All' ? selectedMonth + ' ' : ''}${selectedYear}.`}
            </p>
            {attendedFestivals.length === 0 && (
              <button className="btn btn-primary" onClick={() => navigate('/')} id="go-discover-timeline">
                Discover Festivals
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {filtered.map(f => (
              <div
                key={f.id}
                className="fade-in"
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: 16,
                  overflow: 'hidden',
                  transition: 'border-color 250ms ease',
                  cursor: 'pointer',
                }}
                onClick={() => navigate(`/festival/${f.id}`)}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-hover)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                {/* Festival header */}
                <div style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  {f.meta?.image && (
                    <img
                      src={f.meta.image}
                      alt=""
                      style={{ width: 56, height: 56, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }}
                    />
                  )}
                  {!f.meta?.image && (
                    <div style={{ width: 56, height: 56, borderRadius: 10, background: 'var(--gradient-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>🎪</div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.1rem', marginBottom: 4 }}>
                      {f.meta?.name ?? f.id}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      <span>📅 {formatDate(f.meta?.date)}</span>
                      {f.meta?.venue?.name && (
                        <span>📍 {f.meta.venue.name}{f.meta.venue.city ? `, ${f.meta.venue.city}` : ''}</span>
                      )}
                    </div>
                  </div>
                  {f.meta?.genre && <span className="tag">{f.meta.genre}</span>}
                </div>

                {/* Artists seen at this festival */}
                {f.seen.length > 0 && (
                  <div style={{ padding: '0 24px 20px', borderTop: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', margin: '14px 0 10px' }}>
                      Artists Seen ({f.seen.length})
                    </div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      {f.seen.map(a => (
                        <div
                          key={a.id}
                          onClick={e => { e.stopPropagation(); navigate(`/artist/${encodeURIComponent(a.name)}?id=${a.id}`) }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '6px 12px', borderRadius: 999,
                            background: 'var(--bg-glass)', border: '1px solid var(--border)',
                            fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-primary)',
                            cursor: 'pointer', transition: 'border-color 200ms ease',
                          }}
                          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-hover)'}
                          onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                        >
                          {a.image ? (
                            <img src={a.image} alt="" style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover' }} />
                          ) : (
                            <span>🎤</span>
                          )}
                          <span>{a.name}</span>
                          {a.rating > 0 && (
                            <span style={{ color: '#fbbf24', fontSize: '0.75rem' }}>{a.rating}★</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
