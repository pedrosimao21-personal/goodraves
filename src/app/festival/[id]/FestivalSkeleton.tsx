import styles from './FestivalDetail.module.css'

const SKELETON_ARTISTS = 8

/** Placeholder in the shape of the festival header and lineup grid. */
export default function FestivalSkeleton() {
  return (
    <div className="page" aria-busy="true" aria-label="Loading festival">
      <div className="container">
        <div className={styles.skeletonHeader}>
          <div className={`skeleton ${styles.skeletonFlyer}`} />
          <div className={styles.skeletonDetails}>
            <div className={`skeleton ${styles.skeletonLine}`} />
            <div className={`skeleton ${styles.skeletonTitle}`} />
            <div className={`skeleton ${styles.skeletonLineWide}`} />
            <div className={`skeleton ${styles.skeletonLineWide}`} />
          </div>
        </div>
        <div className={styles.skeletonGrid}>
          {Array.from({ length: SKELETON_ARTISTS }).map((_, i) => (
            <div key={i} className={`skeleton ${styles.skeletonArtist}`} />
          ))}
        </div>
      </div>
    </div>
  )
}
