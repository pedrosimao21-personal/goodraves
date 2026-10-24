'use client'

import { useState } from 'react'
import Sheet, { SheetActions } from './Sheet'
import styles from './LineupAdminSheets.module.css'

type Props = {
  artistName: string
  /** Removes the artist from the lineup; a rejection keeps the sheet open with the error. */
  onConfirm: () => Promise<unknown>
  onClose: () => void
}

/** Admin confirm step before taking an artist off a festival's lineup. */
export default function LineupRemoveSheet({ artistName, onConfirm, onClose }: Props) {
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConfirm() {
    setIsBusy(true)
    setError(null)
    try {
      await onConfirm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove the artist. Try again.')
      setIsBusy(false)
    }
  }

  return (
    <Sheet title="Remove from lineup?" eyebrow={artistName} onClose={onClose}>
      <p className={styles.text}>
        This takes {artistName} off this festival&apos;s lineup and timetable, and deletes the ratings and picks people
        saved for this set. It stays off when the festival is re-imported. The artist&apos;s page and other festivals are
        not affected.
      </p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <SheetActions>
        <button type="button" className="btn" onClick={onClose}>Cancel</button>
        <button type="button" className="btn btn-danger" onClick={handleConfirm} disabled={isBusy}>
          {isBusy ? 'Removing…' : 'Remove'}
        </button>
      </SheetActions>
    </Sheet>
  )
}
