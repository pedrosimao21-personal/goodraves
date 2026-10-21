import StatsTabs from '@/components/StatsTabs'
import styles from './TopDjs.module.css'

const SKELETON_ROWS = 6

export default function Loading() {
  return (
    <div className="page" aria-busy="true" aria-label="Loading your top DJs">
      <div className="container">
        <StatsTabs active="top-djs" />
        {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
          <div key={i} className={`skeleton ${styles.skeletonRow}`} />
        ))}
      </div>
    </div>
  )
}
