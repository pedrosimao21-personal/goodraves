'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function ProfilePage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  if (status === 'unauthenticated') {
    router.push('/')
    return null
  }

  if (status === 'loading' || !session) {
    return (
      <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ height: 40, width: 40, borderRadius: '50%', background: 'var(--bg-card)', animation: 'pulse 1.5s ease-in-out infinite' }} />
      </div>
    )
  }

  return (
    <div className="page">
      <div className="container" style={{ paddingTop: 32 }}>
        <h1 className="section-title" style={{ fontSize: '2.5rem', fontFamily: 'var(--font-display)', fontWeight: 800, marginBottom: 8 }}>
          My Profile
        </h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: 32 }}>
          Manage your account and discover tailored events
        </p>

        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', marginBottom: 48 }}>
          <div style={{ padding: 24, background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--gradient-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', color: 'var(--text-primary)' }}>
                {session.user?.name?.[0]?.toUpperCase() || 'U'}
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem' }}>{session.user?.name}</h3>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{session.user?.email}</span>
              </div>
            </div>
          </div>

          <Link href="/insights" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{ padding: 24, background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border)', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', transition: 'transform 200ms ease, border-color 200ms ease', cursor: 'pointer' }}
                 onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-hover)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)' }}
                 onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.transform = 'none' }}
            >
              <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '1.4rem' }}>📊</span> Personal Insights
              </h3>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                View your festival activity, top genres, and interactive heatmaps.
              </p>
            </div>
          </Link>
        </div>

        <h2 className="section-title" style={{ marginBottom: 16, fontSize: '1.5rem' }}>Nearby Shows</h2>
        <div style={{ padding: 32, background: 'var(--bg-card)', borderRadius: 16, border: '1px dashed var(--border)', textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 16 }}>📍</div>
          <h3 style={{ margin: '0 0 8px 0' }}>Shows near your location</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: 400, margin: '0 auto 16px auto' }}>
            We'll use your location to find upcoming raves and festivals near you.
          </p>
          <button className="btn btn-primary" style={{ opacity: 0.7, cursor: 'not-allowed' }} disabled>Coming Soon</button>
        </div>

        <h2 className="section-title" style={{ marginBottom: 16, fontSize: '1.5rem' }}>Tailored for You</h2>
        <div style={{ padding: 32, background: 'var(--bg-card)', borderRadius: 16, border: '1px dashed var(--border)', textAlign: 'center', marginBottom: 48 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 16 }}>🎧</div>
          <h3 style={{ margin: '0 0 8px 0' }}>Shows based on your favorite genres</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: 400, margin: '0 auto 16px auto' }}>
            Set your favorite genres to receive personalized event recommendations.
          </p>
          <button className="btn btn-primary" style={{ opacity: 0.7, cursor: 'not-allowed' }} disabled>Coming Soon</button>
        </div>

      </div>
    </div>
  )
}
