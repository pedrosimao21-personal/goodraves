'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div style={{ fontSize: '3rem', marginBottom: 16 }}>⚠️</div>
      <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: 8 }}>Failed to load artist</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: 24, textAlign: 'center', maxWidth: 500 }}>
        {error.message || 'Could not load artist details.'}
      </p>
      <button className="btn btn-primary" onClick={reset}>
        Try again
      </button>
    </div>
  )
}
