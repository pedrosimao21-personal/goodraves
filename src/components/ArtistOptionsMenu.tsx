'use client'

import Sheet from './Sheet'
import { EditIcon, FriendsIcon, MergeIcon } from './icons'
import styles from './SheetMenu.module.css'

interface ArtistOptionsMenuProps {
  onEditName: () => void
  onSplitB2b: () => void
  onCreateB2b: () => void
  onClose: () => void
}

/** Admin actions for one lineup artist. */
export default function ArtistOptionsMenu({ onEditName, onSplitB2b, onCreateB2b, onClose }: ArtistOptionsMenuProps) {
  return (
    <Sheet title="Lineup artist" eyebrow="Admin · lineup" onClose={onClose}>
      <div className={styles.list}>
        <button type="button" className={styles.item} onClick={onEditName}>
          <EditIcon />Edit artist name
        </button>
        <button type="button" className={styles.item} onClick={onCreateB2b}>
          <MergeIcon />Create B2B with…
        </button>
        <button type="button" className={styles.item} onClick={onSplitB2b}>
          <FriendsIcon />Split B2B artist
        </button>
      </div>
    </Sheet>
  )
}
