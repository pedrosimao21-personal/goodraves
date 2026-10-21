'use client'

import styles from './ArtistPage.module.css'

export default function Error({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="page">
      <div className="container">
        <div className={styles.message} role="alert">
          <h1 className={`display ${styles.messageTitle}`}>Couldn&apos;t load this artist.</h1>
          <p className={styles.messageText}>Something went wrong while loading the artist details. Try again, or refresh the page.</p>
          <button type="button" className="btn btn-primary" onClick={reset}>Try again</button>
        </div>
      </div>
    </div>
  )
}
