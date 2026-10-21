'use client'

import { useState } from 'react'
import Sheet, { SheetActions } from '@/components/Sheet'
import styles from './Dashboard.module.css'

type Props = {
  list: 'past' | 'upcoming'
  count: number
  /** Clears the list; a rejection keeps the sheet open with the error. */
  onConfirm: () => Promise<unknown>
  onClose: () => void
}

/**
 * Confirm step before clearing a whole list. clearUserFestivals deletes the
 * list rows (vibe ratings, notes, comments) and the set ratings with them.
 */
export default function ClearListSheet({ list, count, onConfirm, onClose }: Props) {
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConfirm() {
    setIsBusy(true)
    setError(null)
    try {
      await onConfirm()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not clear the list. Try again.')
      setIsBusy(false)
    }
  }

  return (
    <Sheet title={`Clear your ${list} list?`} eyebrow="My festivals" onClose={onClose}>
      <p className={styles.sheetText}>
        This removes all {count} {list} festival{count === 1 ? '' : 's'} from your list, with the set
        ratings, vibe ratings and notes saved for them. You can&apos;t undo this.
      </p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <SheetActions>
        <button type="button" className="btn" onClick={onClose}>Keep them</button>
        <button type="button" className="btn btn-danger" onClick={handleConfirm} disabled={isBusy}>
          {isBusy ? 'Clearing…' : 'Clear list'}
        </button>
      </SheetActions>
    </Sheet>
  )
}
