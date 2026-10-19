'use client'

import { useState } from 'react'
import { useFollows } from '@/context/FollowsContext'

type FollowButtonVariant = 'pill' | 'icon'

/**
 * Follow / unfollow an artist. `pill` is the labelled button (artist page,
 * Top DJs modal, /following); `icon` is the small corner toggle on lineup
 * artist cards, where a full button would crowd the "want to see" control.
 */
export default function FollowButton({
  artistId,
  artistName,
  variant = 'pill',
  isCompactOnMobile = false,
}: {
  artistId: string
  artistName: string
  variant?: FollowButtonVariant
  // Pill shows only the heart at phone width, for tight rows (Top DJs).
  isCompactOnMobile?: boolean
}) {
  const { isFollowing, toggleFollow } = useFollows()
  const [isPending, setIsPending] = useState(false)
  const [hasError, setHasError] = useState(false)
  const following = isFollowing(artistId)
  const label = following ? `Unfollow ${artistName}` : `Follow ${artistName}`

  const handleClick = async (e: React.MouseEvent) => {
    // Lineup cards wrap everything in a stretched link; don't navigate.
    e.preventDefault()
    e.stopPropagation()
    setIsPending(true)
    setHasError(false)
    try {
      await toggleFollow(artistId)
    } catch (err) {
      console.error('[FollowButton] Follow toggle failed:', err)
      setHasError(true)
    } finally {
      setIsPending(false)
    }
  }

  if (variant === 'icon') {
    return (
      <button
        className={`follow-icon-btn${following ? ' is-active' : ''}`}
        onClick={handleClick}
        disabled={isPending}
        aria-pressed={following}
        aria-label={label}
        title={hasError ? 'Could not update, try again' : label}
      >
        {following ? '♥' : '♡'}
      </button>
    )
  }

  return (
    <button
      className={`btn btn-sm ${following ? 'btn-secondary' : 'btn-primary'} follow-btn${isCompactOnMobile ? ' follow-btn-compact-mobile' : ''}`}
      onClick={handleClick}
      disabled={isPending}
      aria-pressed={following}
      aria-label={label}
      title={hasError ? 'Could not update, try again' : undefined}
    >
      {following ? '♥' : '♡'}
      <span className="follow-btn-label">{following ? ' Following' : ' Follow'}</span>
    </button>
  )
}
