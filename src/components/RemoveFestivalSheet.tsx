'use client'

import { useState } from 'react'
import { useUserDataActions } from '@/context/UserDataContext'
import Sheet, { SheetActions } from './Sheet'
import styles from './RemoveFestivalSheet.module.css'

type Props = {
  eventId: string
  name: string
  /** Removes the festival; a rejection keeps the sheet open with the error. */
  onConfirm: () => Promise<unknown>
  onClose: () => void
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

/**
 * What removing the festival deletes along with it: removeAttendance drops
 * the per-set ratings and the attendance row that holds the vibe rating,
 * notes and public comment.
 */
function useLossSummary(eventId: string): string[] {
  const { getSeenCount, getFestivalRating, getFestivalNotes, getFestivalPublicComment } = useUserDataActions()
  const seen = getSeenCount(eventId)
  return [
    seen > 0 ? `the ${seen} set${seen === 1 ? '' : 's'} you marked as seen, with their ratings` : null,
    getFestivalRating(eventId) > 0 ? 'your vibe rating' : null,
    getFestivalNotes(eventId) ? 'your personal notes' : null,
    getFestivalPublicComment(eventId) ? 'your public comment' : null,
  ].filter((item): item is string => item !== null)
}

/** Confirm step before taking a festival off the user's list. */
export default function RemoveFestivalSheet({ eventId, name, onConfirm, onClose }: Props) {
  const losses = useLossSummary(eventId)
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConfirm() {
    setIsBusy(true)
    setError(null)
    try {
      await onConfirm()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove the festival. Try again.')
      setIsBusy(false)
    }
  }

  return (
    <Sheet title="Remove festival?" eyebrow={name} onClose={onClose}>
      <p className={styles.text}>
        {losses.length > 0
          ? <>This also deletes {joinList(losses)}. You can&apos;t undo this.</>
          : <>It comes off your festivals. Nothing else is saved for it.</>}
      </p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <SheetActions>
        <button type="button" className="btn" onClick={onClose}>Keep it</button>
        <button type="button" className="btn btn-danger" onClick={handleConfirm} disabled={isBusy}>
          {isBusy ? 'Removing…' : 'Remove'}
        </button>
      </SheetActions>
    </Sheet>
  )
}
