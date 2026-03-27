import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUserData } from '../context/UserDataContext'
import { getEventById } from '../api/ticketmaster'
import RAImport from '../components/RAImport'

const HAS_KEY = import.meta.env.VITE_TICKETMASTER_KEY &&
  import.meta.env.VITE_TICKETMASTER_KEY !== 'your_ticketmaster_api_key_here'

function formatDate(dateStr) {
  if (!dateStr) return 'Date TBA'
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function FestivalRow({ eventId, onRemove, isUpcomingTab }) {
  const navigate = useNavigate()
  const { getSeenCount, performanceRatings, seenArtists } = useUserData()
  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (eventId.startsWith('ra-')) {
      setLoading(false)
      return
    }
    if (!HAS_KEY) { setLoading(false); return }
    getEventById(eventId)
      .then(setEvent)
      .catch(() => setEvent(null))
      .finally(() => setLoading(false))
  }, [eventId])

  const { getFestivalMeta } = useUserData()
  const raMeta = eventId.startsWith('ra-') ? getFestivalMeta(eventId) : null
  const displayEvent = raMeta || event

  const seenCount = getSeenCount(eventId)
  const seenIds = seenArtists[eventId] ?? []
  
  // Calculate average performance rating for this specific festival
  const ratings = seenIds.map(id => performanceRatings[`${eventId}::${id}`]).filter(Boolean)
  const avgRating = ratings.length > 0
    ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)
    : null

  if (loading) {
    return <div className="skeleton" style={{ height: 80, borderRadius: 12 }} />
  }

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        flexWrap: 'wrap',
        cursor: 'pointer',
        transition: 'border-color 250ms ease',
      }}
      onClick={() => navigate(`/festival/${eventId}`)}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-hover)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
    >
      {displayEvent?.image && (
        <img
          src={displayEvent.image}
          alt=""
          style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
        />
      )}
      {!displayEvent?.image && <div style={{ width: 56, height: 56, borderRadius: 8, background: 'var(--gradient-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>{eventId.startsWith('ra-') ? '🎧' : '🎪'}</div>}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {displayEvent?.name ?? eventId}
          </div>
          {eventId.startsWith('ra-') && <span className="source-badge source-badge-edm" style={{ background: '#000', fontSize: '0.65rem', padding: '1px 4px' }}>RA</span>}
        </div>
        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {displayEvent?.date && <span>📅 {formatDate(displayEvent.date)}</span>}
          {displayEvent?.venue && <span>📍 {displayEvent.venue.name}{displayEvent.venue.city ? `, ${displayEvent.venue.city}` : ''}</span>}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexShrink: 0 }}>
        {!isUpcomingTab && seenCount > 0 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 800, background: 'var(--gradient-hero)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{seenCount}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Artists seen</div>
          </div>
        )}
        {!isUpcomingTab && avgRating && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 800, color: '#fbbf24' }}>{avgRating}★</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Avg rating</div>
          </div>
        )}
      </div>

      <button
        className="btn-ghost"
        style={{ fontSize: '0.8rem', color: 'var(--text-muted)', flexShrink: 0 }}
        onClick={e => { e.stopPropagation(); onRemove(eventId) }}
        id={`remove-${eventId}`}
        title="Remove from list"
      >
        ✕
      </button>
    </div>
  )
}

export default function Dashboard() {
  const {
    attendedFestivals,
    upcomingFestivals,
    seenArtists,
    performanceRatings,
    artistNotes,
    toggleAttended,
    toggleUpcoming,
    exportData,
    importData,
  } = useUserData()
  const navigate = useNavigate()
  const [showImport, setShowImport] = useState(false)
  const [activeTab, setActiveTab] = useState('attended')
  const fileInputRef = useRef(null)

  const handleImportFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result)
        if (data && typeof data === 'object') {
          importData(data)
          alert('Profile successfully restored!')
        }
      } catch (err) {
        alert('Invalid backup file.')
      }
      e.target.value = '' // Reset input
    }
    reader.readAsText(file)
  }

  const totalSeen = Object.values(seenArtists).reduce((sum, arr) => sum + arr.length, 0)
  const allRatings = Object.values(performanceRatings)
  const avgRatingAll = allRatings.length > 0
    ? (allRatings.reduce((a, b) => a + b, 0) / allRatings.length).toFixed(1)
    : null
  const totalNotes = Object.values(artistNotes).filter(n => n.trim()).length
  
  const displayList = activeTab === 'attended' ? attendedFestivals : upcomingFestivals
  const removeHandler = activeTab === 'attended' ? toggleAttended : toggleUpcoming

  return (
    <div className="page">
      <div className="container">
        <div style={{ paddingTop: 8, marginBottom: 32 }}>
          <h1 className="section-title" style={{ fontSize: '2rem', fontFamily: 'var(--font-display)', fontWeight: 800, marginBottom: 6 }}>
            My Festivals
          </h1>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Your personal festival history & schedule</p>
            </div>
            <button
              className={`btn ${showImport ? 'btn-secondary' : 'btn-primary'}`}
              onClick={() => setShowImport(!showImport)}
              id="toggle-import-btn"
            >
              {showImport ? 'Close Import' : '📦 Import RA Data'}
            </button>
          </div>
        </div>

        {showImport && (
          <div style={{ marginBottom: 40 }}>
            <RAImport />
          </div>
        )}

        {/* Stats */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Festivals Attended</div>
            <div className="stat-value">{attendedFestivals.length}</div>
            <div className="stat-sub">festivals on record</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Artists Seen</div>
            <div className="stat-value">{totalSeen}</div>
            <div className="stat-sub">live performances tracked</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Avg. Rating</div>
            <div className="stat-value">{avgRatingAll ?? '—'}</div>
            <div className="stat-sub">{allRatings.length} sets rated</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Upcoming</div>
            <div className="stat-value">{upcomingFestivals.length}</div>
            <div className="stat-sub">future festivals planned</div>
          </div>
        </div>

        <div className="divider" />
        
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
          <button
            className={`btn ${activeTab === 'attended' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('attended')}
            style={activeTab === 'attended' ? {} : { border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          >
            Past Festivals ({attendedFestivals.length})
          </button>
          <button
            className={`btn ${activeTab === 'upcoming' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('upcoming')}
            style={activeTab === 'upcoming' ? { background: '#3b82f6', color: '#fff', borderColor: '#3b82f6' } : { border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          >
            Upcoming Events ({upcomingFestivals.length})
          </button>
        </div>

        {displayList.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🎟️</div>
            <h3>No {activeTab} festivals yet</h3>
            <p>Head to the Discover page to find festivals and mark them to your schedule.</p>
            <button className="btn btn-primary" onClick={() => navigate('/')} id="go-discover-btn">
              Discover Festivals
            </button>
          </div>
        ) : (
          <>
            <div className="section-header">
              <h2 className="section-title">{activeTab === 'attended' ? 'Attended Festivals' : 'Upcoming Festivals'}</h2>
              {activeTab === 'attended' && (
                <div style={{ display: 'flex', gap: 10 }}>
                  <input
                    type="file"
                    accept=".json"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    onChange={handleImportFile}
                  />
                  <button
                    id="import-backup-btn"
                    className="btn btn-secondary btn-sm"
                    onClick={() => fileInputRef.current?.click()}
                    title="Import your data from a JSON backup"
                  >
                    ↑ Import
                  </button>
                  <button
                    id="export-btn"
                    className="btn btn-secondary btn-sm"
                    onClick={exportData}
                    title="Export your data as JSON"
                  >
                    ↓ Export
                  </button>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {displayList.map(id => (
                <FestivalRow key={id} eventId={id} onRemove={removeHandler} isUpcomingTab={activeTab === 'upcoming'} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
