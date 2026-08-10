'use client'

import React, { useState, useMemo, useRef, lazy, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useUserData } from '@/context/UserDataContext'
import { useAuthPrompt } from '@/context/AuthPromptContext'
import AddCustomEvent from '@/components/AddCustomFestival'
import EditFestivalModal from './EditFestivalModal'
import FestivalRow from './FestivalRow'
import TimelineView from './TimelineView'
import TrendingFestivalsSection from '@/components/TrendingFestivalsSection'
import type { TrendingFestival } from '@/db/actions/trending-festivals'
import { buildIcsCalendar, downloadIcsFile, type IcsFestival } from '@/lib/ics'

const AvgVibeModal = lazy(() => import('./AvgVibeModal'))

const CLEAR_LIST_COLOR = 'var(--accent-red-bright)'
const UPCOMING_BG_COLOR = 'var(--state-going)'
// Matches the CSS breakpoint that hides .dashboard-tab-row — below it the
// stat cards are the only way to navigate, so a tap should also scroll the
// corresponding list into view instead of leaving it off-screen.
const MOBILE_BREAKPOINT_PX = 640

type ActiveTab = 'attended' | 'upcoming' | 'timeline'

function getTabFromHash(): ActiveTab {
  if (typeof window === 'undefined') return 'attended'
  if (window.location.hash === '#upcoming') return 'upcoming'
  if (window.location.hash === '#timeline') return 'timeline'
  return 'attended'
}

type Props = {
  trendingFestivals: TrendingFestival[]
  userCity: string | null
}

export default function DashboardView({ trendingFestivals, userCity }: Props) {
  const {
    attendedFestivals, upcomingFestivals, festivalRatings,
    toggleFestival, clearFestivals, getFestivalMeta, loaded, isAdmin,
  } = useUserData()
  const { promptAuth } = useAuthPrompt()
  const { data: session } = useSession()
  const router = useRouter()
  const [showAddCustom, setShowAddCustom] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showVibeModal, setShowVibeModal] = useState(false)

  const [activeTab, setActiveTab] = useState<ActiveTab>(getTabFromHash)

  // Persist timeline filter selections when switching tabs
  const [timelineYear, setTimelineYear] = useState<number | null>(null)
  const [timelineMonth, setTimelineMonth] = useState<string>('All')

  const listSectionRef = useRef<HTMLDivElement>(null)

  const switchToTab = (tab: ActiveTab) => {
    const hash = tab === 'attended' ? '' : `#${tab}`
    history.replaceState(null, '', `${window.location.pathname}${hash}`)
    setActiveTab(tab)
    if (window.innerWidth <= MOBILE_BREAKPOINT_PX) {
      listSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const ratedFestivals = useMemo(() =>
    attendedFestivals
      .map(id => ({ id, meta: getFestivalMeta(id), rating: festivalRatings?.[id] ?? 0 }))
      .filter(f => f.rating > 0)
      .map(f => ({ id: f.id, name: f.meta?.name ?? f.id, date: f.meta?.date ?? null, rating: f.rating }))
      .sort((a, b) => b.rating - a.rating),
  [attendedFestivals, getFestivalMeta, festivalRatings])

  const festivalRatingValues = useMemo(
    () => attendedFestivals.map(id => festivalRatings?.[id]).filter((r): r is number => !!r && r > 0),
    [attendedFestivals, festivalRatings]
  )
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

  const handleExportUpcoming = () => {
    const festivals: IcsFestival[] = sortedUpcoming.map(id => {
      const meta = getFestivalMeta(id)
      const venue = typeof meta?.venue === 'object' ? meta.venue : null
      return {
        id,
        name: meta?.name ?? id,
        date: meta?.date ?? '',
        endDate: meta?.endDate,
        venueName: venue?.name ?? (typeof meta?.venue === 'string' ? meta.venue : null),
        location: venue?.city ?? meta?.location ?? null,
      }
    }).filter(f => f.date)
    downloadIcsFile('goodraves-upcoming-festivals.ics', buildIcsCalendar(festivals))
  }

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
          <div
            className="stat-card stat-card-clickable"
            role="button"
            tabIndex={0}
            onClick={() => switchToTab('attended')}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); switchToTab('attended') } }}
          >
            <div className="stat-label">Festivals Attended</div>
            <div className="stat-value">{attendedFestivals.length}</div>
            <div className="stat-sub">festivals on record</div>
          </div>
          <div
            className="stat-card stat-card-clickable"
            role="button"
            tabIndex={0}
            onClick={() => switchToTab('upcoming')}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); switchToTab('upcoming') } }}
          >
            <div className="stat-label">Upcoming</div>
            <div className="stat-value">{upcomingFestivals.length}</div>
            <div className="stat-sub">future festivals planned</div>
          </div>
          <div
            className="stat-card stat-card-clickable"
            role="button"
            tabIndex={0}
            onClick={() => setShowVibeModal(true)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowVibeModal(true) } }}
          >
            <div className="stat-label">Avg. Vibe</div>
            <div className="stat-value">{avgRatingAll ?? '\u2014'}</div>
            <div className="stat-sub">{festivalRatingValues.length} festivals rated</div>
          </div>
          <div
            className="stat-card stat-card-clickable"
            role="button"
            tabIndex={0}
            onClick={() => switchToTab('timeline')}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); switchToTab('timeline') } }}
          >
            <div className="stat-label">All-Time Festivals</div>
            <div className="stat-value">{attendedFestivals.length}</div>
            <div className="stat-sub">view your timeline</div>
          </div>
        </div>

        <div className="divider" ref={listSectionRef} />

        <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="dashboard-tab-row">
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
                  ? { background: UPCOMING_BG_COLOR, color: 'var(--color-white)', borderColor: UPCOMING_BG_COLOR }
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
          </div>
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
              <div style={{ display: 'flex', gap: 8 }}>
                {activeTab === 'upcoming' && (
                  <button className="btn btn-ghost btn-sm" onClick={handleExportUpcoming}>
                    Export to Calendar
                  </button>
                )}
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

      {showVibeModal && (
        <Suspense fallback={null}>
          <AvgVibeModal festivals={ratedFestivals} onClose={() => setShowVibeModal(false)} />
        </Suspense>
      )}

      {trendingFestivals.length > 0 && (
        <div className="container" style={{ paddingBottom: 48 }}>
          <div className="divider" />
          <TrendingFestivalsSection festivals={trendingFestivals} userCity={userCity} />
        </div>
      )}
    </div>
  )
}