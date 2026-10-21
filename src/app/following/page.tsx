'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useFollows } from '@/context/FollowsContext'
import { getFollowingPage, type FollowingPageData } from '@/db/actions/following-feed'
import { getFollowSuggestions, type FollowSuggestion } from '@/db/actions/follow-suggestions'
import FollowingGigList from './FollowingGigList'
import FollowedArtistsGrid from './FollowedArtistsGrid'
import FollowSuggestions from './FollowSuggestions'
import MostFollowedList from './MostFollowedList'
import FollowingArtistSearch from './FollowingArtistSearch'
import styles from './Following.module.css'

const SKELETON_ROWS = [1, 2, 3]

function FollowingSkeleton() {
  return (
    <div className="page" aria-busy="true" aria-label="Loading the artists you follow">
      <div className="container">
        <div className={`skeleton ${styles.skeletonTitle}`} />
        {SKELETON_ROWS.map((i) => <div key={i} className={`skeleton ${styles.skeletonRow}`} />)}
      </div>
    </div>
  )
}

/** Following. Boards: Following, FollowingMobile, FollowingEmptyMobile. */
export default function FollowingPage() {
  const { status } = useSession()
  const router = useRouter()
  const { version } = useFollows()
  const [data, setData] = useState<FollowingPageData | null>(null)
  const [suggestions, setSuggestions] = useState<FollowSuggestion[]>([])
  const [error, setError] = useState<string | null>(null)

  // Refetch whenever a follow changes anywhere (version bumps), so following
  // a suggestion or unfollowing from the list updates the gig feed too.
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
      <div className="page">
        <div className="container">
          <p className="form-error" role="alert">{error}</p>
        </div>
      </div>
    )
  }
  if (status !== 'authenticated' || !data) return <FollowingSkeleton />

  const artistCount = data.artists.length
  const hasArtists = artistCount > 0

  return (
    <div className="page">
      <div className="container">
        <div className={styles.header}>
          <div>
            {hasArtists && (
              <p className={`mono ${styles.eyebrow}`}>
                Gigs from the {artistCount} artist{artistCount === 1 ? '' : 's'} you follow
              </p>
            )}
            <h1 className={`display ${styles.title}`}>Following</h1>
          </div>
          <FollowingArtistSearch />
        </div>

        {!hasArtists && (
          <p className={styles.intro}>
            Follow an artist and their next gigs on Goodraves land here, with set times and clashes.
            Search above, or tap the heart on an artist in a lineup or on their page. Only your friends
            can see who you follow.
          </p>
        )}

        {hasArtists && (
          <div className={styles.layout}>
            <section className={styles.main}>
              <FollowingGigList gigs={data.gigs} userCity={data.userCity} />
            </section>
            <aside className={styles.aside}>
              <FollowedArtistsGrid artists={data.artists} />
            </aside>
          </div>
        )}

        <FollowSuggestions suggestions={suggestions} />
        {/* Without follows or rated sets to suggest from, fall back to what others follow. */}
        {!hasArtists && suggestions.length === 0 && <MostFollowedList />}
      </div>
    </div>
  )
}
