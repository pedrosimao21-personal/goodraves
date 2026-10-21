import StatsTabs from '@/components/StatsTabs'
import styles from './Insights.module.css'

export default function Loading() {
  return (
    <div className="page" aria-busy="true" aria-label="Loading your insights">
      <div className="container">
        <StatsTabs active="insights" />
        <div className={`skeleton ${styles.skeletonBlock}`} />
      </div>
    </div>
  )
}
