'use client'

import React, { useState, useMemo, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useUserData } from '@/context/UserDataContext'
import { useAuthPrompt } from '@/context/AuthPromptContext'
import RAImport from '@/components/RAImport'
import AddCustomEvent from '@/components/AddCustomFestival'
import EditFestivalModal from './EditFestivalModal'
import FestivalRow from './FestivalRow'
import { searchFestivalsDB } from '@/db/actions/festival-search'
import Link from 'next/link'
import Image from 'next/image'

function SimpleFestivalRow({ fest }: { fest: any }) {
  const href = `/festival/${fest.id}`
  return (
    <Link href={href} style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '12px',
      background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12,
      textDecoration: 'none', color: 'inherit', transition: 'border-color 200ms ease'
    }}>
      {fest.imageUrl ? (
        <Image src={fest.imageUrl} alt={fest.name} width={48} height={48} style={{ borderRadius: 8, objectFit: 'cover' }} />
      ) : (
        <div style={{ width: 48, height: 48, borderRadius: 8, background: 'var(--gradient-card)', flexShrink: 0 }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{fest.name}</div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{fest.date} &middot; {fest.location || 'Unknown location'}</div>
      </div>
    </Link>
  )
}

const CLEAR_LIST_COLOR = '#ff4444'
const UPCOMING_BG_COLOR = '#3b82f6'

export default function DashboardView() {
  const {
    attendedFestivals, upcomingFestivals, seenArtists, festivalRatings,
    toggleAttended, toggleUpcoming, importData, clearFestivals, getFestivalMeta, loaded,
  } = useUserData()
  const { promptAuth } = useAuthPrompt()
  const { data: session } = useSession()
  const router = useRouter()
  const [showImport, setShowImport] = useState(false)
  const [showAddCustom, setShowAddCustom] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const getTabFromHash = () => (typeof window !== 'undefined' && window.location.hash === '#upcoming') ? 'upcoming' : 'attended'
  const [activeTab, setActiveTab] = useState<'attended' | 'upcoming'>(getTabFromHash)

  const [nearbyShows, setNearbyShows] = useState<any[]>([])
  const [nearbyLoading, setNearbyLoading] = useState(false)
  const [tailoredShows, setTailoredShows] = useState<any[]>([])
  const [tailoredLoading, setTailoredLoading] = useState(false)
  const [userLocation, setUserLocation] = useState('')
  const [userGenres, setUserGenres] = useState('')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const loc = localStorage.getItem('user_location')
      const gen = localStorage.getItem('user_genres')
      setUserLocation(loc || '')
      setUserGenres(gen || '')

      if (loc) {
        setNearbyLoading(true)
        searchFestivalsDB(loc).then(res => {
          setNearbyShows(res.slice(0, 5))
          setNearbyLoading(false)
        }).catch(() => setNearbyLoading(false))
      }
      
      if (gen) {
        setTailoredLoading(true)
        const firstGenre = gen.split(',')[0].trim()
        searchFestivalsDB(firstGenre).then(res => {
          setTailoredShows(res.slice(0, 5))
          setTailoredLoading(false)
        }).catch(() => setTailoredLoading(false))
      }
    }
  }, [])

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string)
        if (data && typeof data === 'object') {
          importData(data)
          alert('Profile successfully restored!')
        }
      } catch {
        alert('Invalid backup file.')
      }
      e.target.value = ''
    }
    reader.readAsText(file)
  }

  const totalSeen = (Object.values(seenArtists) as string[][]).reduce((sum, arr) => sum + arr.length, 0)
  const festivalRatingValues = attendedFestivals
    .map(id => festivalRatings?.[id])
    .filter((r): r is number => !!r && r > 0)
  const avgRatingAll = festivalRatingValues.length > 0
    ? (festivalRatingValues.reduce((a, b) => a + b, 0) / festivalRatingValues.length).toFixed(1)
    : null

  const sortedAttended = useMemo(() =>
    [...attendedFestivals].sort((a, b) => {
      const da = getFestivalMeta(a)?.date ?? ''
      const dateB = getFestivalMeta(b)?.date ?? ''
      return dateB.localeCompare(da)
    }),
  [attendedFestivals, getFestivalMeta])

  const sortedUpcoming = useMemo(() =>
    [...upcomingFestivals].sort((a, b) => {
      const da = getFestivalMeta(a)?.date ?? ''
      const dateB = getFestivalMeta(b)?.date ?? ''
      return da.localeCompare(dateB)
    }),
  [upcomingFestivals, getFestivalMeta])

  const displayList = activeTab === 'attended' ? sortedAttended : sortedUpcoming
  const removeHandler = activeTab === 'attended' ? toggleAttended : toggleUpcoming

  if (!loaded) {
    return (
      <div className="page">
        <div className="container" style={{ paddingTop: 32 }}>
          <div className="loading-skeleton" style={{ height: 40, width: 200, marginBottom: 24, borderRadius: 8, background: 'var(--bg-card)', animation: 'pulse 1.5s ease-in-out infinite' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ height: 80, borderRadius: 12, background: 'var(--bg-card)', animation: 'pulse 1.5s ease-in-out infinite', animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="container">
        <div style={{ paddingTop: 8, marginBottom: 32 }}>
          <h1 className="section-title" style={{ fontSize: '2rem', fontFamily: 'var(--font-display)', fontWeight: 800, marginBottom: 6 }}>
            My Festivals
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Your personal festival history &amp; schedule</p>
        </div>

        {showImport && (
          <div style={{ marginBottom: 40 }}>
            <RAImport />
          </div>
        )}

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
            <div className="stat-label">Avg. Vibe</div>
            <div className="stat-value">{avgRatingAll ?? '\u2014'}</div>
            <div className="stat-sub">{festivalRatingValues.length} festivals rated</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Upcoming</div>
            <div className="stat-value">{upcomingFestivals.length}</div>
            <div className="stat-sub">future festivals planned</div>
          </div>
        </div>

        <div className="divider" />

        <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            className={`btn ${activeTab === 'attended' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => { window.location.hash = ''; setActiveTab('attended') }}
            style={activeTab === 'attended' ? {} : { border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          >
            Past ({attendedFestivals.length})
          </button>
          <button
            className={`btn ${activeTab === 'upcoming' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => { window.location.hash = 'upcoming'; setActiveTab('upcoming') }}
            style={activeTab === 'upcoming' ? { background: UPCOMING_BG_COLOR, color: '#fff', borderColor: UPCOMING_BG_COLOR } : { border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          >
            Upcoming ({upcomingFestivals.length})
          </button>
          <div style={{ marginLeft: 'auto' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => {
                if (!session?.user) { promptAuth(); return }
                setShowAddCustom(!showAddCustom)
              }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              {showAddCustom ? 'Close' : '+ Add Event'}
            </button>
          </div>
        </div>

        {showAddCustom && (
          <div style={{ marginBottom: 24 }}>
            <AddCustomEvent onClose={() => setShowAddCustom(false)} />
          </div>
        )}

        {displayList.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">&#127915;</div>
            <h3>No {activeTab} festivals yet</h3>
            <p>Head to the Discover page to find festivals and mark them to your schedule.</p>
            <button className="btn btn-primary" onClick={() => router.push('/')} id="go-discover-btn">
              Discover Festivals
            </button>
          </div>
        ) : (
          <>
            <div className="section-header">
              <h2 className="section-title">{activeTab === 'attended' ? 'Attended Festivals' : 'Upcoming Festivals'}</h2>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  if (confirm(`Are you sure you want to clear your ${activeTab} list? This will also remove any artist ratings associated with these festivals.`)) {
                    clearFestivals(activeTab)
                  }
                }}
                style={{ color: CLEAR_LIST_COLOR }}
              >
                Clear List
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {displayList.map(id => (
                <FestivalRow
                  key={id}
                  eventId={id}
                  onRemove={removeHandler}
                  isUpcomingTab={activeTab === 'upcoming'}
                  onEdit={setEditingId}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="container" style={{ paddingTop: 0, paddingBottom: 64 }}>
        {(userLocation || userGenres) && (
          <div className="divider" style={{ margin: '32px 0' }} />
        )}

        {userLocation && (
          <div style={{ marginBottom: 40 }}>
            <h2 className="section-title" style={{ marginBottom: 16 }}>Shows near {userLocation}</h2>
            {nearbyLoading ? (
              <div style={{ color: 'var(--text-muted)' }}>Finding shows...</div>
            ) : nearbyShows.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {nearbyShows.map(fest => <SimpleFestivalRow key={fest.id} fest={fest} />)}
              </div>
            ) : (
              <div style={{ padding: 24, background: 'var(--bg-card)', borderRadius: 16, border: '1px dashed var(--border)', textAlign: 'center', color: 'var(--text-muted)' }}>
                No upcoming shows found near {userLocation}.
              </div>
            )}
          </div>
        )}

        {userGenres && (
          <div style={{ marginBottom: 40 }}>
            <h2 className="section-title" style={{ marginBottom: 16 }}>Tailored for You ({userGenres})</h2>
            {tailoredLoading ? (
              <div style={{ color: 'var(--text-muted)' }}>Finding events...</div>
            ) : tailoredShows.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {tailoredShows.map(fest => <SimpleFestivalRow key={fest.id} fest={fest} />)}
              </div>
            ) : (
              <div style={{ padding: 24, background: 'var(--bg-card)', borderRadius: 16, border: '1px dashed var(--border)', textAlign: 'center', color: 'var(--text-muted)' }}>
                No events matched your favorite genres right now.
              </div>
            )}
          </div>
        )}
      </div>

      {editingId && (
        <EditFestivalModal eventId={editingId} onClose={() => setEditingId(null)} />
      )}
    </div>
  )
}
