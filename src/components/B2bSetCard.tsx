'use client'

import { memo, useState, lazy, Suspense, Fragment } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useUserDataActions } from '@/context/UserDataContext'
import type { B2bSetData } from '@/context/user-data-state'
import RatingFader from './rating/RatingFader'
import Sheet, { SheetActions } from './Sheet'
import { DotsIcon } from './icons'
import styles from './B2bSetCard.module.css'

const B2bMembersModal = lazy(() => import('./B2bMembersModal'))

/** Up to three member avatars fit the square; more members still list by name. */
const MAX_AVATARS = 3
const AVATAR_SIZE = 160

interface B2bSetCardProps {
  b2bSet: B2bSetData
  eventId: string
  spotifyData: Record<string, any>
  /** Show the rating controls (festival has started). */
  canRate: boolean
}

const B2bSetCard = memo(function B2bSetCard({ b2bSet, eventId, spotifyData, canRate }: B2bSetCardProps) {
  const { getPerformanceRating, didSeeArtist, rateB2bSet, unsplitB2bSet, isAdmin } = useUserDataActions()
  const firstMember = b2bSet.members[0]
  const currentRating = firstMember ? getPerformanceRating(eventId, firstMember.artistId) : 0
  const [showUnsplitConfirm, setShowUnsplitConfirm] = useState(false)
  const [showMembersModal, setShowMembersModal] = useState(false)
  const isSeenUnrated = currentRating === 0 && Boolean(firstMember) && didSeeArtist(eventId, firstMember.artistId)
  const avatarMembers = b2bSet.members.slice(0, MAX_AVATARS)
  const ariaDisplayName = b2bSet.members.map((m) => m.artistName).join(' b2b ')

  const handleUnsplit = async () => {
    await unsplitB2bSet(b2bSet.id, b2bSet.festivalId)
    setShowUnsplitConfirm(false)
  }

  return (
    <>
      <article className={`${styles.card} fade-in`} onClick={() => setShowMembersModal(true)}>
        <div
          className={styles.avatars}
          style={{ gridTemplateColumns: `repeat(${avatarMembers.length}, minmax(0, 1fr))` }}
          aria-hidden="true"
        >
          {avatarMembers.map((member) => {
            const memberImage = spotifyData[member.artistName]?.image ?? null
            return (
              <span key={member.artistId} className={styles.member}>
                {memberImage ? (
                  <Image className={styles.memberImage} src={memberImage} alt="" width={AVATAR_SIZE} height={AVATAR_SIZE} quality={85} sizes="120px" />
                ) : (
                  <span className={`display ${styles.monogram}`}>{member.artistName[0]}</span>
                )}
              </span>
            )
          })}
        </div>
        {isAdmin && (
          <button
            type="button"
            className={styles.adminButton}
            onClick={(e) => { e.stopPropagation(); setShowUnsplitConfirm(true) }}
            aria-label={`Admin options for ${ariaDisplayName}`}
          >
            <DotsIcon />
          </button>
        )}

        <div className={styles.tagRow}><span className="tag">B2B</span></div>
        <h3 className={styles.name}>
          {b2bSet.members.map((m, idx) => (
            <Fragment key={m.artistId}>
              {idx > 0 && <span className={styles.joiner}> b2b </span>}
              <Link
                href={`/artist/${m.artistId}/${encodeURIComponent(m.artistName)}`}
                className={styles.memberLink}
                onClick={(e) => e.stopPropagation()}
              >
                {m.artistName}
              </Link>
            </Fragment>
          ))}
        </h3>

        {/* One tap rates every member and marks them as seen (rateB2bSet). */}
        {canRate && (
          <div className={styles.controls}>
            <RatingFader
              value={currentRating}
              onChange={(rating) => rateB2bSet(b2bSet.id, rating)}
              label={`Rate ${ariaDisplayName}`}
            />
            {isSeenUnrated && <span className={`mono ${styles.seenNote}`}>Seen</span>}
          </div>
        )}
      </article>

      {showMembersModal && (
        <Suspense fallback={null}>
          <B2bMembersModal b2bSet={b2bSet} spotifyData={spotifyData} onClose={() => setShowMembersModal(false)} />
        </Suspense>
      )}

      {showUnsplitConfirm && (
        <Sheet title="Remove B2B" eyebrow="Admin · lineup" onClose={() => setShowUnsplitConfirm(false)}>
          <p className={styles.confirmText}>
            Remove the B2B grouping for <strong>{b2bSet.originalArtistName}</strong>? The artists will reappear individually in the lineup.
          </p>
          <SheetActions>
            <button type="button" className="btn" onClick={() => setShowUnsplitConfirm(false)}>Cancel</button>
            <button type="button" className="btn btn-primary" onClick={handleUnsplit}>Remove B2B</button>
          </SheetActions>
        </Sheet>
      )}
    </>
  )
})

export default B2bSetCard
