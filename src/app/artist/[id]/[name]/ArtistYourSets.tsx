'use client'

import { useState } from 'react'
import type { ArtistSetEntry } from '@/context/user-data-state'
import ArtistSetHistory from '@/components/ArtistSetHistory'
import SectionHeading from './SectionHeading'
import styles from './ArtistBody.module.css'

const COLLAPSED_SET_COUNT = 4

/** Your history with this artist, newest first. Boards: Artist and ArtistMobile ("Your sets"). */
export default function ArtistYourSets({ sets }: { sets: ArtistSetEntry[] }) {
  const [isExpanded, setIsExpanded] = useState(false)
  if (sets.length === 0) return null
  const visible = isExpanded ? sets : sets.slice(0, COLLAPSED_SET_COUNT)

  return (
    <section>
      <SectionHeading title="Your sets" meta={String(sets.length)} />
      <ArtistSetHistory sets={visible} />
      {sets.length > COLLAPSED_SET_COUNT && (
        <button type="button" className={`mono ${styles.textButton}`} onClick={() => setIsExpanded(!isExpanded)}>
          {isExpanded ? 'Show fewer' : `Show all ${sets.length} sets`}
        </button>
      )}
    </section>
  )
}
