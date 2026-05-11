'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState, useEffect } from 'react'
export default function ProfilePage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [locationInput, setLocationInput] = useState('')
  const [locationSaved, setLocationSaved] = useState('')
  const [genreInput, setGenreInput] = useState('')
  const [genresSaved, setGenresSaved] = useState<string>('')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const loc = localStorage.getItem('user_location') || ''
      const gen = localStorage.getItem('user_genres') || ''
      setLocationInput(loc)
      setLocationSaved(loc)
      setGenreInput(gen)
      setGenresSaved(gen)
    }
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const loc = localStorage.getItem('user_location')
      if (loc) {
        setLocationSaved(loc)
        setLocationInput(loc)
      }
      
      const gen = localStorage.getItem('user_genres')
      if (gen) {
        setGenresSaved(gen)
        setGenreInput(gen)
      }
    }
  }, [])

  const saveLocation = () => {
    localStorage.setItem('user_location', locationInput)
    setLocationSaved(locationInput)
  }

  const saveGenres = () => {
    localStorage.setItem('user_genres', genreInput)
    setGenresSaved(genreInput)
  }

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

        <h2 className="section-title" style={{ marginBottom: 16, fontSize: '1.5rem' }}>Personalize Your Feed</h2>
        <div style={{ marginBottom: 32, display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: 'var(--text-muted)' }}>Location for Nearby Shows</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input 
                type="text" 
                value={locationInput}
                onChange={e => setLocationInput(e.target.value)}
                placeholder="Enter your city (e.g. Amsterdam, Berlin)"
                style={{ flex: 1, padding: '12px 16px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'inherit' }}
              />
              <button className="btn btn-primary" onClick={saveLocation}>Save</button>
            </div>
            {locationSaved && <p style={{ marginTop: 8, fontSize: '0.85rem', color: '#1DB954' }}>✓ Location saved. Recommendations will appear on your Dashboard.</p>}
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: 'var(--text-muted)' }}>Favorite Genres</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input 
                type="text" 
                value={genreInput}
                onChange={e => setGenreInput(e.target.value)}
                placeholder="e.g. Techno, House, Trance"
                style={{ flex: 1, padding: '12px 16px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'inherit' }}
              />
              <button className="btn btn-primary" onClick={saveGenres}>Save</button>
            </div>
            {genresSaved && <p style={{ marginTop: 8, fontSize: '0.85rem', color: '#1DB954' }}>✓ Genres saved. Recommendations will appear on your Dashboard.</p>}
          </div>
        </div>

      </div>
    </div>
  )
}
