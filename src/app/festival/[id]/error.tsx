'use client'

import styles from './FestivalDetail.module.css'

export default function Error({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="page">
      <div className="container">
        <div className={styles.error} role="alert">
          <h1 className={`display ${styles.errorTitle}`}>Couldn&apos;t load this festival.</h1>
          <p className={styles.errorText}>Something went wrong while loading the festival details. Try again, or refresh the page.</p>
          <button type="button" className="btn btn-primary" onClick={reset}>Try again</button>
        </div>
      </div>
    </div>
  )
}
