'use client'

import { useState, type FormEvent } from 'react'
import Sheet, { SheetActions } from './Sheet'
import styles from './LineupAdminSheets.module.css'

type Props = {
  artistName: string
  /** Sets and locks the photo from a pasted link; a rejection keeps the sheet open with its message. */
  onSetFromLink: (link: string) => Promise<unknown>
  onRemove: () => Promise<unknown>
  onReset: () => Promise<unknown>
  onClose: () => void
}

/** Admin: fix a wrong or missing artist photo. The result is locked, so automatic matching never replaces it. */
export default function ArtistPhotoSheet({ artistName, onSetFromLink, onRemove, onReset, onClose }: Props) {
  const [link, setLink] = useState('')
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(action: () => Promise<unknown>) {
    setIsBusy(true)
    setError(null)
    try {
      await action()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change the photo. Try again.')
      setIsBusy(false)
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (link.trim()) run(() => onSetFromLink(link))
  }

  return (
    <Sheet title="Fix photo" eyebrow={`Admin · ${artistName}`} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <p className={styles.text}>
          Paste the right artist&apos;s <strong>Spotify</strong> link or <strong>Resident Advisor</strong> DJ page, or an image
          link. The photo is then locked: automatic matching won&apos;t replace it.
        </p>
        <label className="form-label" htmlFor="artist-photo-link">Link</label>
        <input
          id="artist-photo-link"
          className="form-input"
          placeholder="https://open.spotify.com/artist/… or https://ra.co/dj/…"
          value={link}
          onChange={(event) => setLink(event.target.value)}
          autoFocus
        />
        {error && <p className={`form-error ${styles.errorGap}`} role="alert">{error}</p>}
        <SheetActions>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={isBusy || !link.trim()}>
            {isBusy ? 'Saving…' : 'Use this photo'}
          </button>
        </SheetActions>
      </form>
      <div className={styles.photoShortcuts}>
        <button type="button" className="btn btn-sm btn-danger" disabled={isBusy} onClick={() => run(onRemove)}>Remove photo</button>
        <button type="button" className="btn btn-sm" disabled={isBusy} onClick={() => run(onReset)}>Back to automatic</button>
      </div>
    </Sheet>
  )
}
