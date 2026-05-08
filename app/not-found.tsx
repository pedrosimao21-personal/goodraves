'use client'

export default function NotFound() {
  return (
    <div className="page">
      <div className="container" style={{ textAlign: 'center', paddingTop: 80 }}>
        <div style={{ fontSize: '4rem', marginBottom: 16 }}>🎵</div>
        <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: 8 }}>Page Not Found</h2>
        <p style={{ color: 'var(--text-muted)' }}>This page doesn&apos;t exist.</p>
      </div>
    </div>
  )
}
