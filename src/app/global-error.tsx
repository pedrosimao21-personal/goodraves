'use client'

import styles from './GlobalError.module.css'

// Last-resort boundary for an error thrown by the root layout itself (e.g.
// auth() failing on a corrupted session cookie): error.tsx can only catch
// errors from its children, not from the layout wrapping it. Next.js
// requires this file to render its own <html>/<body> since it replaces the
// entire root layout when it's shown, so globals.css, the fonts and the
// theme attribute are all missing. Its module carries hardcoded colours.
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body className={styles.body}>
        <main className={styles.message} role="alert">
          <p className={styles.brand}>Goodraves</p>
          <h1 className={styles.title}>Something went wrong.</h1>
          <p className={styles.text}>Goodraves couldn&apos;t load. Try again, or refresh the page.</p>
          <button type="button" className={styles.button} onClick={reset}>Try again</button>
        </main>
      </body>
    </html>
  )
}
