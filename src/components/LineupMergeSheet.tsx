'use client'

import { useMemo, useState } from 'react'
import { foldArtistName } from '@/lib/lineup-name'
import Sheet, { SheetActions } from './Sheet'
import styles from './LineupAdminSheets.module.css'
import listStyles from './B2bModals.module.css'

type ArtistOption = { id: string; name: string }

type Props = {
  /** The duplicate: this entry leaves the lineup. */
  artist: ArtistOption
  /** Everyone else on the lineup; the one picked is kept. */
  candidates: ArtistOption[]
  /** Merges the duplicate into the picked artist; a rejection keeps the sheet open with the error. */
  onConfirm: (keepId: string) => Promise<unknown>
  onClose: () => void
}

/** Admin: pick the lineup entry to keep when the same artist is listed twice (e.g. with and without an accent). */
export default function LineupMergeSheet({ artist, candidates, onConfirm, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [keepId, setKeepId] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Same-name-different-spelling entries first: that's almost always the one wanted.
  const options = useMemo(() => {
    const key = foldArtistName(artist.name)
    return candidates
      .filter((candidate) => candidate.id !== artist.id && candidate.name.toLowerCase().includes(query.toLowerCase()))
      .map((candidate) => ({ ...candidate, isLikely: foldArtistName(candidate.name) === key }))
      .sort((a, b) => Number(b.isLikely) - Number(a.isLikely))
  }, [artist, candidates, query])
  const keepName = candidates.find((candidate) => candidate.id === keepId)?.name

  async function handleConfirm() {
    if (!keepId) return
    setIsBusy(true)
    setError(null)
    try {
      await onConfirm(keepId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not merge the artists. Try again.')
      setIsBusy(false)
    }
  }

  return (
    <Sheet title="Merge duplicate" eyebrow={`Admin · ${artist.name}`} onClose={onClose}>
      <p className={styles.text}>
        Pick the entry to keep. Ratings, picks and timetable slots of <strong>{artist.name}</strong> move to it, and{' '}
        {artist.name} leaves this lineup for good.
      </p>
      <label className="form-label" htmlFor="lineup-merge-search">Keep</label>
      <input
        id="lineup-merge-search"
        className="form-input"
        placeholder="Search lineup…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        autoFocus
      />
      <div className={`${listStyles.list} ${listStyles.scroll}`}>
        {options.length === 0 ? (
          <p className="form-hint">No other artists in the lineup.</p>
        ) : (
          options.map((option) => (
            <label key={option.id} className={listStyles.option}>
              <input type="radio" name="lineup-merge-keep" checked={keepId === option.id} onChange={() => setKeepId(option.id)} />
              {option.name}
              {option.isLikely && <span className={`mono ${styles.likely}`}>Same name</span>}
            </label>
          ))
        )}
      </div>
      {keepName && <p className={styles.text}>{artist.name} becomes {keepName}.</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <SheetActions>
        <button type="button" className="btn" onClick={onClose}>Cancel</button>
        <button type="button" className="btn btn-primary" onClick={handleConfirm} disabled={isBusy || !keepId}>
          {isBusy ? 'Merging…' : 'Merge'}
        </button>
      </SheetActions>
    </Sheet>
  )
}
