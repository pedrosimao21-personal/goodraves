import styles from './_components/Dashboard.module.css'

const SKELETON_ROWS = 4

export default function Loading() {
  return (
    <div className="page" aria-busy="true" aria-label="Loading your festivals">
      <div className="container">
        <div className={`skeleton ${styles.skeletonTitle}`} />
        <div className={`skeleton ${styles.skeletonStats}`} />
        {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
          <div key={i} className={`skeleton ${styles.skeletonRow}`} />
        ))}
      </div>
    </div>
  )
}
