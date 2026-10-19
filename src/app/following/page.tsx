'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useFollows } from '@/context/FollowsContext'
import { getFollowingPage, type FollowingPageData } from '@/db/actions/following-feed'
import { getFollowSuggestions, type FollowSuggestion } from '@/db/actions/follow-suggestions'
import FollowingGigList from './FollowingGigList'
import FollowedArtistsGrid from './FollowedArtistsGrid'
import FollowSuggestions from './FollowSuggestions'

const SKELETON_ROWS = [1, 2, 3]

function FollowingSkeleton() {
  return (
    <div className="page">
      <div className="container" style={{ paddingTop: 32 }}>
        <div style={{ height: 40, width: 220, marginBottom: 24, borderRadius: 8, background: 'var(--bg-card)', animation: 'pulse 1.5s ease-in-out infinite' }} />
        {SKELETON_ROWS.map((i) => (
          <div key={i} style={{ height: 96, marginBottom: 10, borderRadius: 12, background: 'var(--bg-card)', animation: 'pulse 1.5s ease-in-out infinite' }} />
        ))}
      </div>
    </div>
  )
}

function EmptyFollowing() {
  return (
    <p style={{ color: 'var(--text-muted)', marginBottom: 32 }}>
      You don&apos;t follow anyone yet. Tap ♡ on an artist in a{' '}
      <Link href="/" style={{ color: 'var(--accent-purple)' }}>festival lineup</Link> or on their profile, and
      their upcoming festivals show up here.
    </p>
  )
}

export default function FollowingPage() {
  const { status } = useSession()
  const router = useRouter()
  const { version } = useFollows()
  const [data, setData] = useState<FollowingPageData | null>(null)
  const [suggestions, setSuggestions] = useState<FollowSuggestion[]>([])
  const [error, setError] = useState<string | null>(null)

  // Refetch whenever a follow changes anywhere (version bumps), so following
  // a suggestion or unfollowing from the grid updates the gig feed too.
  useEffect(() => {
    if (status !== 'authenticated') return
    Promise.all([getFollowingPage(), getFollowSuggestions()])
      .then(([page, nextSuggestions]) => {
        setData(page)
        setSuggestions(nextSuggestions)
        setError(null)
      })
      .catch((err) => {
        console.error('[FollowingPage] Failed to load:', err)
        setError('Could not load the artists you follow. Try refreshing.')
      })
  }, [status, version])

  // A redirect belongs in an effect, not the render body (see friends/page.tsx).
  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login?callbackUrl=/following')
  }, [status, router])

  if (error) {
    return (
      <div className="page"><div className="container" style={{ paddingTop: 32 }}>
        <p style={{ color: 'var(--error-text)' }}>{error}</p>
      </div></div>
    )
  }
  if (status !== 'authenticated' || !data) return <FollowingSkeleton />

  const hasArtists = data.artists.length > 0

  return (
    <div className="page">
      <div className="container" style={{ paddingTop: 32, paddingBottom: 48 }}>
        <h1 className="section-title" style={{ fontSize: '2.5rem', marginBottom: 8 }}>Following</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: 32 }}>
          Upcoming festivals of the artists you follow, straight from Goodraves lineups.
        </p>

        {!hasArtists && <EmptyFollowing />}
        <FollowSuggestions suggestions={suggestions} />

        {hasArtists && (
          <>
            <section style={{ marginBottom: 40 }}>
              <h2 className="section-title" style={{ fontSize: '1.1rem', marginBottom: 12 }}>Upcoming gigs</h2>
              <FollowingGigList gigs={data.gigs} userCity={data.userCity} />
            </section>

            <section>
              <h2 className="section-title" style={{ fontSize: '1.1rem', marginBottom: 12 }}>
                Artists you follow ({data.artists.length})
              </h2>
              <FollowedArtistsGrid artists={data.artists} />
            </section>
          </>
        )}
      </div>
    </div>
  )
}
