import Link from 'next/link'
import styles from './StatsTabs.module.css'

const STATS_TABS = [
  { key: 'top-djs', label: 'Top DJs', href: '/top-djs' },
  { key: 'insights', label: 'Insights', href: '/insights' },
] as const

type StatsTabKey = (typeof STATS_TABS)[number]['key']

/** Page title and tabs for the Stats section (Top DJs and Insights). */
export default function StatsTabs({ active }: { active: StatsTabKey }) {
  return (
    <div className={styles.header}>
      <h1 className={`display ${styles.title}`}>Stats</h1>
      <nav className={styles.tabs} aria-label="Stats sections">
        {STATS_TABS.map((tab) => {
          const isActive = tab.key === active
          return (
            <Link
              key={tab.key}
              href={tab.href}
              className={`${styles.tab} ${isActive ? styles.tabActive : ''}`}
              aria-current={isActive ? 'page' : undefined}
            >
              {tab.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
