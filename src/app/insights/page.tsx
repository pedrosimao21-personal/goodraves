'use client'

import dynamic from 'next/dynamic'
import { useUserData } from '@/context/UserDataContext'
import StatsTabs from '@/components/StatsTabs'
import { CityBars, GenreBars, YearBars } from './InsightsCharts'
import PassportSection from './PassportSection'
import { useInsightsData } from './use-insights-data'
import styles from './Insights.module.css'

const RaveMap = dynamic(() => import('@/components/RaveMap'), { ssr: false })

function Panel({ title, meta, className = '', children }: { title: string; meta?: string; className?: string; children: React.ReactNode }) {
  return (
    <section className={`${styles.panel} ${className}`}>
      <div className={styles.panelHeader}>
        <h2 className={`display ${styles.panelTitle}`}>{title}</h2>
        {meta && <span className={`mono ${styles.muted}`}>{meta}</span>}
      </div>
      {children}
    </section>
  )
}

/** Stats › Insights. Boards: Insights, InsightsMobile. */
export default function Insights() {
  const { loaded } = useUserData()
  const { attendedEvents, years, genres, cities, topCities } = useInsightsData()

  if (!loaded) {
    return (
      <div className="page" aria-busy="true" aria-label="Loading your insights">
        <div className="container">
          <StatsTabs active="insights" />
          <div className={`skeleton ${styles.skeletonBlock}`} />
        </div>
      </div>
    )
  }

  const eventCount = attendedEvents.length
  const total = `${eventCount} event${eventCount === 1 ? '' : 's'}`

  return (
    <div className="page">
      <div className="container">
        <StatsTabs active="insights" />

        <div className={styles.row}>
          <Panel title="Where you raved" meta={`${total} · ${cities.length} cities`} className={styles.mapPanel}>
            {eventCount > 0
              ? <RaveMap events={attendedEvents} />
              : <p className={styles.muted}>Mark a festival as attended and it shows up on the map.</p>}
          </Panel>
          <Panel title="Top cities" className={styles.sidePanel}>
            {topCities.length > 0 ? <CityBars data={topCities} /> : <p className={styles.muted}>No city data yet.</p>}
          </Panel>
        </div>

        <div className={styles.row}>
          <Panel title="Festivals per year" meta={`${eventCount} total`} className={styles.halfPanel}>
            {years.length > 0 ? <YearBars data={years} /> : <p className={styles.muted}>No data yet. Mark some past events as attended.</p>}
          </Panel>
          <Panel title="Genres" meta="Share of sets seen" className={styles.halfPanel}>
            {genres.length > 0 ? <GenreBars data={genres} /> : <p className={styles.muted}>No genre data yet.</p>}
          </Panel>
        </div>

        <PassportSection attendedEvents={attendedEvents} />
      </div>
    </div>
  )
}
