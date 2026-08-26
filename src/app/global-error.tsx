'use client'

// Last-resort boundary for an error thrown by the root layout itself (e.g.
// auth() failing on a corrupted session cookie) — error.tsx can only catch
// errors from ITS children, not from the layout wrapping it. Next.js
// requires this file to render its own <html>/<body> since it replaces the
// entire root layout when it's shown, so it can't reuse app styles/fonts —
// this is deliberately plain, dependency-free markup.
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'system-ui, sans-serif', background: '#0b0b0f', color: '#f5f5f7', padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: 16 }}>⚠️</div>
          <h2 style={{ marginBottom: 8 }}>Something went wrong</h2>
          <p style={{ color: '#a1a1aa', marginBottom: 24, maxWidth: 500 }}>
            An unexpected error occurred. Please try again.
          </p>
          <button
            onClick={reset}
            style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: '#7c3aed', color: '#fff', fontSize: '0.95rem', cursor: 'pointer' }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
