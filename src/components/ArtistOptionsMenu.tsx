'use client'

import Sheet from './Sheet'
import { CloseIcon, EditIcon, FriendsIcon, LinkIcon, MergeIcon } from './icons'
import styles from './SheetMenu.module.css'

interface ArtistOptionsMenuProps {
  onEditName: () => void
  onSplitB2b: () => void
  onCreateB2b: () => void
  onMergeDuplicate: () => void
  onFixPhoto: () => void
  onRemove: () => void
  onClose: () => void
}

/** Admin actions for one lineup artist. */
export default function ArtistOptionsMenu({ onEditName, onSplitB2b, onCreateB2b, onMergeDuplicate, onFixPhoto, onRemove, onClose }: ArtistOptionsMenuProps) {
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
        <button type="button" className={styles.item} onClick={onMergeDuplicate}>
          <MergeIcon />Merge duplicate into…
        </button>
        <button type="button" className={styles.item} onClick={onFixPhoto}>
          <LinkIcon />Fix photo…
        </button>
        <button type="button" className={`${styles.item} ${styles.danger}`} onClick={onRemove}>
          <CloseIcon />Remove from lineup
        </button>
      </div>
    </Sheet>
  )
}
