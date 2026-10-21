'use client'

import { useState } from 'react'
import { useFollows } from '@/context/FollowsContext'
import { HeartIcon } from '@/components/icons'
import styles from './FollowButton.module.css'

type FollowButtonVariant = 'pill' | 'icon'

const PILL_ICON_SIZE = 16
const ICON_SIZE = 20

/**
 * Follow / unfollow an artist. `pill` is the labelled button (artist page,
 * Top DJs modal, /following); `icon` is the heart toggle for dense rows and
 * lineup cards.
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
        type="button"
        className={`${styles.icon} ${following ? styles.iconActive : ''}`}
        onClick={handleClick}
        disabled={isPending}
        aria-pressed={following}
        aria-label={label}
        title={hasError ? 'Could not update, try again' : label}
      >
        <HeartIcon size={ICON_SIZE} filled={following} />
      </button>
    )
  }

  return (
    <button
      type="button"
      className={`btn btn-sm ${following ? styles.following : ''} ${isCompactOnMobile ? styles.compactOnMobile : ''}`}
      onClick={handleClick}
      disabled={isPending}
      aria-pressed={following}
      aria-label={label}
      title={hasError ? 'Could not update, try again' : undefined}
    >
      <HeartIcon size={PILL_ICON_SIZE} filled={following} />
      <span className={styles.label}>{following ? 'Following' : 'Follow'}</span>
    </button>
  )
}
