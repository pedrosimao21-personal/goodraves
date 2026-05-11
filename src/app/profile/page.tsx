'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { searchFestivalsDB } from '@/db/actions/festival-search'
import { getUserProfile, updateUserProfile } from '@/db/actions/profile'

function FestivalRow({ fest }: { fest: any }) {
  const href = `/festival/${fest.id}`
  return (
    <Link href={href} style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '12px',
      background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12,
      textDecoration: 'none', color: 'inherit', transition: 'border-color 200ms ease'
    }}>
      {fest.imageUrl ? (
        <Image src={fest.imageUrl} alt={fest.name} width={48} height={48} style={{ borderRadius: 8, objectFit: 'cover' }} />
      ) : (
        <div style={{ width: 48, height: 48, borderRadius: 8, background: 'var(--gradient-card)', flexShrink: 0 }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{fest.name}</div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{fest.date} &middot; {fest.location || fest.venue}</div>
      </div>
    </Link>
  )
}

export default function ProfilePage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [locationInput, setLocationInput] = useState('')
  const [locationSaved, setLocationSaved] = useState('')
  const [genreInput, setGenreInput] = useState('')
  const [genresSaved, setGenresSaved] = useState('')
  const [isSavingLocation, setIsSavingLocation] = useState(false)
  const [isSavingGenres, setIsSavingGenres] = useState(false)

  const [nearbyShows, setNearbyShows] = useState<any[]>([])
  const [nearbyLoading, setNearbyLoading] = useState(false)
  const [tailoredShows, setTailoredShows] = useState<any[]>([])
  const [tailoredLoading, setTailoredLoading] = useState(false)

  const loadNearbyShows = useCallback((city: string) => {
    setNearbyLoading(true)
    searchFestivalsDB(city)
      .then(res => { setNearbyShows(res.slice(0, 5)); setNearbyLoading(false) })
      .catch(() => setNearbyLoading(false))
  }, [])

  const loadTailoredShows = useCallback((genres: string) => {
    const firstGenre = genres.split(',')[0].trim()
    if (!firstGenre) return
    setTailoredLoading(true)
    searchFestivalsDB(firstGenre)
      .then(res => { setTailoredShows(res.slice(0, 5)); setTailoredLoading(false) })
      .catch(() => setTailoredLoading(false))
  }, [])

  // Load profile from DB on mount; migrate localStorage data if DB fields are empty
  useEffect(() => {
    if (status !== 'authenticated') return

    getUserProfile()
      .then(async (profile) => {
        if (!profile) return

        const localCity = typeof window !== 'undefined' ? localStorage.getItem('user_location') ?? '' : ''
        const localGenres = typeof window !== 'undefined' ? localStorage.getItem('user_genres') ?? '' : ''

        const city = profile.city ?? ''
        const genres = profile.favoriteGenres ?? ''

        // Migrate localStorage → DB if DB is empty but localStorage has data
        if (!city && localCity) {
          await updateUserProfile({ city: localCity }).catch(() => {})
          localStorage.removeItem('user_location')
          setLocationInput(localCity)
          setLocationSaved(localCity)
          if (localCity) loadNearbyShows(localCity)
        } else {
          setLocationInput(city)
          setLocationSaved(city)
          if (city) loadNearbyShows(city)
        }

        if (!genres && localGenres) {
          await updateUserProfile({ favoriteGenres: localGenres }).catch(() => {})
          localStorage.removeItem('user_genres')
          setGenreInput(localGenres)
          setGenresSaved(localGenres)
          if (localGenres) loadTailoredShows(localGenres)
        } else {
          setGenreInput(genres)
          setGenresSaved(genres)
          if (genres) loadTailoredShows(genres)
        }
      })
      .catch(() => {
        // Fall back to localStorage if DB fetch fails
        if (typeof window === 'undefined') return
        const city = localStorage.getItem('user_location') ?? ''
        const genres = localStorage.getItem('user_genres') ?? ''
        setLocationInput(city)
        setLocationSaved(city)
        setGenreInput(genres)
        setGenresSaved(genres)
        if (city) loadNearbyShows(city)
        if (genres) loadTailoredShows(genres)
      })
  }, [status, loadNearbyShows, loadTailoredShows])

  const saveLocation = async () => {
    setIsSavingLocation(true)
    try {
      await updateUserProfile({ city: locationInput })
      setLocationSaved(locationInput)
      if (locationInput) loadNearbyShows(locationInput)
    } catch {
      // Optimistically update even if save fails
      setLocationSaved(locationInput)
    } finally {
      setIsSavingLocation(false)
    }
  }

  const saveGenres = async () => {
    setIsSavingGenres(true)
    try {
      await updateUserProfile({ favoriteGenres: genreInput })
      setGenresSaved(genreInput)
      if (genreInput) loadTailoredShows(genreInput)
    } catch {
      setGenresSaved(genreInput)
    } finally {
      setIsSavingGenres(false)
    }
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
          <div style={{ padding: 24, background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--gradient-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', color: 'var(--text-primary)' }}>
                {session.user?.name?.[0]?.toUpperCase() || 'U'}
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem' }}>{session.user?.name}</h3>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{session.user?.email}</span>
              </div>
            </div>

            <div className="divider" style={{ margin: 0 }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                  Location <span style={{ fontWeight: 400 }}>(for Nearby Shows)</span>
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    value={locationInput}
                    onChange={e => setLocationInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveLocation() }}
                    placeholder="e.g. Amsterdam"
                    style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'inherit', fontSize: '0.95rem' }}
                  />
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={saveLocation}
                    disabled={isSavingLocation}
                    style={{ minWidth: 60 }}
                  >
                    {isSavingLocation ? '...' : 'Save'}
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 8, fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                  Favorite Genres
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    value={genreInput}
                    onChange={e => setGenreInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveGenres() }}
                    placeholder="e.g. Techno, House"
                    style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'inherit', fontSize: '0.95rem' }}
                  />
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={saveGenres}
                    disabled={isSavingGenres}
                    style={{ minWidth: 60 }}
                  >
                    {isSavingGenres ? '...' : 'Save'}
                  </button>
                </div>
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
        <div style={{ marginBottom: 32 }}>
          {nearbyLoading ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>Searching for shows near {locationSaved}...</div>
          ) : nearbyShows.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {nearbyShows.map(fest => <FestivalRow key={fest.id} fest={fest} />)}
            </div>
          ) : locationSaved ? (
            <div style={{ padding: 24, background: 'var(--bg-card)', borderRadius: 16, border: '1px dashed var(--border)', textAlign: 'center' }}>
              No upcoming shows found near <b>{locationSaved}</b> in our database.
            </div>
          ) : (
            <div style={{ padding: 32, background: 'var(--bg-card)', borderRadius: 16, border: '1px dashed var(--border)', textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 16 }}>📍</div>
              <h3 style={{ margin: '0 0 8px 0' }}>Shows near your location</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: 400, margin: '0 auto 16px auto' }}>
                Save your city above to find upcoming raves and festivals near you.
              </p>
            </div>
          )}
        </div>

        <h2 className="section-title" style={{ marginBottom: 16, fontSize: '1.5rem' }}>Tailored for You</h2>
        <div style={{ marginBottom: 48 }}>
          {tailoredLoading ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>Finding events for {genresSaved}...</div>
          ) : tailoredShows.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {tailoredShows.map(fest => <FestivalRow key={fest.id} fest={fest} />)}
            </div>
          ) : genresSaved ? (
            <div style={{ padding: 24, background: 'var(--bg-card)', borderRadius: 16, border: '1px dashed var(--border)', textAlign: 'center' }}>
              No events matched your favorite genres in our database right now.
            </div>
          ) : (
            <div style={{ padding: 32, background: 'var(--bg-card)', borderRadius: 16, border: '1px dashed var(--border)', textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 16 }}>🎧</div>
              <h3 style={{ margin: '0 0 8px 0' }}>Shows based on your favorite genres</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: 400, margin: '0 auto 16px auto' }}>
                Set your favorite genres to receive personalized event recommendations.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
