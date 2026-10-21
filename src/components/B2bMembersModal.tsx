'use client'

import Image from 'next/image'
import Link from 'next/link'
import type { B2bSetData } from '@/context/user-data-state'
import Sheet from './Sheet'
import { ChevronRightIcon } from './icons'
import styles from './B2bModals.module.css'

const AVATAR_SIZE = 44

interface B2bMembersModalProps {
  b2bSet: B2bSetData
  spotifyData: Record<string, any>
  onClose: () => void
}

/** Lists the members of a B2B set, each linking to its artist page. */
export default function B2bMembersModal({ b2bSet, spotifyData, onClose }: B2bMembersModalProps) {
  return (
    <Sheet title="B2B set" eyebrow={`${b2bSet.members.length} artists`} onClose={onClose}>
      <div className={styles.list}>
        {b2bSet.members.map((member) => {
          const image = spotifyData[member.artistName]?.image ?? null
          return (
            <Link
              key={member.artistId}
              href={`/artist/${member.artistId}/${encodeURIComponent(member.artistName)}`}
              className={styles.memberRow}
              onClick={onClose}
            >
              <span className={styles.avatar}>
                {image
                  ? <Image src={image} alt="" width={AVATAR_SIZE} height={AVATAR_SIZE} quality={85} sizes="44px" />
                  : member.artistName[0]}
              </span>
              <span className={styles.memberName}>{member.artistName}</span>
              <ChevronRightIcon size={18} />
            </Link>
          )
        })}
      </div>
    </Sheet>
  )
}
