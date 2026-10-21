'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useFollows } from '@/context/FollowsContext'
import FollowButton from '@/components/FollowButton'
import type { FollowSuggestion } from '@/db/actions/follow-suggestions'
import styles from './FollowSuggestions.module.css'

const AVATAR_SIZE = 400

function describeSuggestion(suggestion: FollowSuggestion): string {
  const parts = [`Seen ${suggestion.timesSeen}×`]
  if (suggestion.bestRating) parts.push(`Best ${suggestion.bestRating}/5`)
  if (suggestion.upcomingCount > 0) parts.push(`${suggestion.upcomingCount} upcoming`)
  return parts.join(' · ')
}

/** Artists you've seen and liked but don't follow yet, with a one-tap "Follow all". Board: Following. */
export default function FollowSuggestions({ suggestions }: { suggestions: FollowSuggestion[] }) {
  const { isFollowing, followMany } = useFollows()
  const [isFollowingAll, setIsFollowingAll] = useState(false)
  const [hasError, setHasError] = useState(false)
  const remaining = suggestions.filter((s) => !isFollowing(s.artistId))

  if (remaining.length === 0) return null

  const handleFollowAll = async () => {
    setIsFollowingAll(true)
    setHasError(false)
    try {
      await followMany(remaining.map((s) => s.artistId))
    } catch (err) {
      console.error('[FollowSuggestions] Follow all failed:', err)
      setHasError(true)
    } finally {
      setIsFollowingAll(false)
    }
  }

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <div>
          <h2 className={`display ${styles.title}`}>Suggested for you</h2>
          <p className={styles.subtitle}>Artists you have seen and rated highly but don&apos;t follow yet.</p>
        </div>
        <button type="button" className="btn" onClick={handleFollowAll} disabled={isFollowingAll}>
          {isFollowingAll ? 'Following…' : `Follow all ${remaining.length}`}
        </button>
      </div>
      {hasError && <p className="form-error">Could not follow everyone, try again.</p>}
      <div className={styles.grid}>
        {remaining.map((suggestion) => {
          const href = `/artist/${suggestion.artistId}/${encodeURIComponent(suggestion.name)}`
          return (
            <article key={suggestion.artistId} className={styles.card}>
              <Link href={href} className={styles.photo} aria-label={suggestion.name}>
                {suggestion.imageUrl
                  ? <Image src={suggestion.imageUrl} alt="" width={AVATAR_SIZE} height={AVATAR_SIZE} sizes="(max-width: 640px) 45vw, 200px" />
                  : <span className="display" aria-hidden="true">{suggestion.name[0]}</span>}
              </Link>
              <Link href={href} className={styles.name}>{suggestion.name}</Link>
              <span className={`mono ${styles.why}`}>{describeSuggestion(suggestion)}</span>
              <FollowButton artistId={suggestion.artistId} artistName={suggestion.name} />
            </article>
          )
        })}
      </div>
    </section>
  )
}
