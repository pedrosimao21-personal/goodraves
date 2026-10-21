import styles from './ArtistPage.module.css'

export default function Loading() {
  return (
    <div className="page" aria-busy="true" aria-label="Loading artist">
      <div className="container">
        <div className={styles.skeletonTop}>
          <div className={`skeleton ${styles.skeletonPhoto}`} />
          <div className={`skeleton ${styles.skeletonName}`} />
        </div>
        <div className={styles.skeleton}>
          <div className={`skeleton ${styles.skeletonHeading}`} />
          <div className={`skeleton ${styles.skeletonBlock}`} />
        </div>
      </div>
    </div>
  )
}
