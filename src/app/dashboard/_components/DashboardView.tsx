'use client'

import React, { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useUserData } from '@/context/UserDataContext'
import { useAuthPrompt } from '@/context/AuthPromptContext'
import AddCustomEvent from '@/components/AddCustomFestival'
import EditFestivalModal from './EditFestivalModal'
import FestivalRow from './FestivalRow'
import TimelineView from './TimelineView'

const CLEAR_LIST_COLOR = '#ff4444'
const UPCOMING_BG_COLOR = '#3b82f6'

type ActiveTab = 'attended' | 'upcoming' | 'timeline'

function getTabFromHash(): ActiveTab {
  if (typeof window === 'undefined') return 'attended'
  if (window.location.hash === '#upcoming') return 'upcoming'
  if (window.location.hash === '#timeline') return 'timeline'
  return 'attended'
}

export default function DashboardView() {
  const {
    attendedFestivals, upcomingFestivals, seenArtists, festivalRatings,
    toggleFestival, clearFestivals, getFestivalMeta, loaded, isAdmin,
  } = useUserData()
  const { promptAuth } = useAuthPrompt()
  const { data: session } = useSession()
  const router = useRouter()
  const [showAddCustom, setShowAddCustom] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [activeTab, setActiveTab] = useState<ActiveTab>(getTabFromHash)

  // Persist timeline filter selections when switching tabs
  const [timelineYear, setTimelineYear] = useState<number | null>(null)
  const [timelineMonth, setTimelineMonth] = useState<string>('All')

  const switchToTab = (tab: ActiveTab) => {
    const hash = tab === 'attended' ? '' : `#${tab}`
    history.replaceState(null, '', `${window.location.pathname}${hash}`)
    setActiveTab(tab)
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
  const removeHandler = toggleFestival

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
            onClick={() => switchToTab('attended')}
            style={activeTab === 'attended' ? {} : { border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          >
            Past ({attendedFestivals.length})
          </button>
          <button
            className={`btn ${activeTab === 'upcoming' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => switchToTab('upcoming')}
            style={
              activeTab === 'upcoming'
                ? { background: UPCOMING_BG_COLOR, color: '#fff', borderColor: UPCOMING_BG_COLOR }
                : { border: '1px solid var(--border)', color: 'var(--text-primary)' }
            }
          >
            Upcoming ({upcomingFestivals.length})
          </button>
          <button
            className={`btn ${activeTab === 'timeline' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => switchToTab('timeline')}
            style={activeTab === 'timeline' ? {} : { border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          >
            Timeline
          </button>
          {activeTab !== 'timeline' && isAdmin && (
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
          )}
        </div>

        {showAddCustom && activeTab !== 'timeline' && (
          <div style={{ marginBottom: 24 }}>
            <AddCustomEvent onClose={() => setShowAddCustom(false)} />
          </div>
        )}

        {activeTab === 'timeline' ? (
          <TimelineView
            initialYear={timelineYear}
            initialMonth={timelineMonth}
            onYearChange={setTimelineYear}
            onMonthChange={setTimelineMonth}
          />
        ) : displayList.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">&#127915;</div>
            <h3>No {activeTab === 'attended' ? 'past' : 'upcoming'} festivals yet</h3>
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
                  if (confirm(`Are you sure you want to clear your ${activeTab === 'attended' ? 'past' : 'upcoming'} list? This will also remove any artist ratings associated with these festivals.`)) {
                    clearFestivals(activeTab === 'attended' ? 'past' : 'upcoming')
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
                  onEdit={isAdmin ? setEditingId : undefined}
                />
              ))}
            </div>
          </>
        )}
      </div>



      {editingId && (
        <EditFestivalModal eventId={editingId} onClose={() => setEditingId(null)} />
      )}
    </div>
  )
}