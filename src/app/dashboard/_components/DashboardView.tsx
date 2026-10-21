'use client'

import { useState, useRef, lazy, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useUserData } from '@/context/UserDataContext'
import { useAuthPrompt } from '@/context/AuthPromptContext'
import AddCustomEvent from '@/components/AddCustomFestival'
import TrendingFestivalsSection from '@/components/TrendingFestivalsSection'
import { CalendarIcon, PlusIcon } from '@/components/icons'
import type { TrendingFestival } from '@/db/actions/trending-festivals'
import { buildIcsCalendar, downloadIcsFile, type IcsFestival } from '@/lib/ics'
import EditFestivalModal from './EditFestivalModal'
import DashboardStats from './DashboardStats'
import DashboardEmpty from './DashboardEmpty'
import FestivalList from './FestivalList'
import NextUpCard from './NextUpCard'
import TimelineView from './TimelineView'
import { useMyFestivals } from './use-my-festivals'
import styles from './Dashboard.module.css'

const AvgVibeModal = lazy(() => import('./AvgVibeModal'))

// Below this width the stats strip sits above the list, so a tap on a stat
// also scrolls the list into view.
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

/** My festivals. Boards: MyFestivals, MyFestivalsMobile, MyFestivalsEmpty. */
export default function DashboardView({ trendingFestivals, userCity }: Props) {
  const { attendedFestivals, upcomingFestivals, toggleFestival, clearFestivals, getFestivalMeta, loaded, isAdmin } = useUserData()
  const mine = useMyFestivals()
  const { promptAuth } = useAuthPrompt()
  const { data: session } = useSession()
  const router = useRouter()
  const [showAddCustom, setShowAddCustom] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showVibeModal, setShowVibeModal] = useState(false)
  const [activeTab, setActiveTab] = useState<ActiveTab>(getTabFromHash)
  // Kept here so the timeline filters survive switching tabs.
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

  const handleExportUpcoming = () => {
    const festivals: IcsFestival[] = mine.sortedUpcoming.map(id => {
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

  const handleClear = () => {
    const list = activeTab === 'attended' ? 'past' : 'upcoming'
    if (confirm(`Are you sure you want to clear your ${list} list? This will also remove any artist ratings associated with these festivals.`)) {
      clearFestivals(list)
    }
  }

  const handleAddEvent = () => {
    if (!session?.user) { promptAuth(); return }
    setShowAddCustom(true)
  }

  if (!loaded) {
    return (
      <div className="page" aria-busy="true" aria-label="Loading your festivals">
        <div className="container">
          <div className={`skeleton ${styles.skeletonTitle}`} />
          <div className={`skeleton ${styles.skeletonStats}`} />
          {[1, 2, 3].map(i => <div key={i} className={`skeleton ${styles.skeletonRow}`} />)}
        </div>
      </div>
    )
  }

  const tabs: { key: ActiveTab; label: string }[] = [
    { key: 'attended', label: `Past · ${attendedFestivals.length}` },
    { key: 'upcoming', label: `Upcoming · ${upcomingFestivals.length}` },
    { key: 'timeline', label: 'Timeline' },
  ]
  const displayList = activeTab === 'attended' ? mine.sortedAttended : mine.sortedUpcoming

  return (
    <div className="page">
      <div className="container">
        <p className={`mono ${styles.eyebrow}`}>Your festival history and schedule</p>
        <h1 className={`display ${styles.title}`}>My festivals</h1>

        <DashboardStats
          attendedCount={attendedFestivals.length}
          upcomingCount={upcomingFestivals.length}
          firstYear={mine.firstYear}
          daysUntilNext={mine.daysUntilNext}
          averageVibe={mine.averageVibe}
          ratedCount={mine.ratedFestivals.length}
          artistsSeen={mine.artistsSeen}
          onShowPast={() => switchToTab('attended')}
          onShowUpcoming={() => switchToTab('upcoming')}
          onShowVibes={() => setShowVibeModal(true)}
          onShowArtists={() => router.push('/top-djs')}
        />

        <div className={styles.layout}>
          <section className={styles.main} ref={listSectionRef}>
            {mine.nextUpcomingId && mine.daysUntilNext !== null && activeTab !== 'timeline' && (
              <NextUpCard festivalId={mine.nextUpcomingId} daysUntilNext={mine.daysUntilNext} />
            )}

            <div className={styles.tabBar}>
              <div className={styles.tabs} role="tablist" aria-label="My festivals">
                {tabs.map(tab => (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === tab.key}
                    className={activeTab === tab.key ? styles.tabOn : undefined}
                    onClick={() => switchToTab(tab.key)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              {activeTab !== 'timeline' && isAdmin && (
                <button type="button" className="btn btn-sm" onClick={handleAddEvent}>
                  <PlusIcon size={15} strokeWidth={2} />Add event
                </button>
              )}
            </div>

            {activeTab === 'timeline' ? (
              <TimelineView
                initialYear={timelineYear}
                initialMonth={timelineMonth}
                onYearChange={setTimelineYear}
                onMonthChange={setTimelineMonth}
              />
            ) : displayList.length === 0 ? (
              <DashboardEmpty isUpcoming={activeTab === 'upcoming'} />
            ) : (
              <FestivalList
                festivalIds={displayList}
                isUpcoming={activeTab === 'upcoming'}
                onRemove={toggleFestival}
                onEdit={isAdmin ? setEditingId : undefined}
                onClear={handleClear}
              />
            )}
          </section>

          <aside className={styles.aside}>
            {trendingFestivals.length > 0 && <TrendingFestivalsSection festivals={trendingFestivals} userCity={userCity} />}
            {mine.sortedUpcoming.length > 0 && (
              <button type="button" className={`btn ${styles.exportButton}`} onClick={handleExportUpcoming}>
                <CalendarIcon size={16} />Export upcoming to calendar
              </button>
            )}
          </aside>
        </div>
      </div>

      {showAddCustom && <AddCustomEvent onClose={() => setShowAddCustom(false)} />}
      {editingId && <EditFestivalModal eventId={editingId} onClose={() => setEditingId(null)} />}
      {showVibeModal && (
        <Suspense fallback={null}>
          <AvgVibeModal festivals={mine.ratedFestivals} onClose={() => setShowVibeModal(false)} />
        </Suspense>
      )}
    </div>
  )
}
