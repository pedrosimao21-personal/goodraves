'use client'

import { useState } from 'react'
import { mergeFestivals, type MergeResult } from '@/db/actions/festivals'
import { keepKeyboardOpenOnTap } from '@/lib/touch-tap'
import Sheet, { SheetActions } from '@/components/Sheet'

const TEXTAREA_ROWS = 3

interface FestivalMergeModalProps {
  /** The festival currently being viewed — becomes the merge winner. */
  winnerId: string
  onClose: () => void
  onMerged: () => void
}

/** Pull a festival id out of a pasted /festival/<id> URL, or return the input as-is. */
function extractFestivalId(input: string): string {
  const match = input.match(/\/festival\/([a-z0-9-]+)/i)
  return match ? match[1] : input
}

function parseLoserIds(raw: string): string[] {
  return raw
    .split(/[\n,]/)
    .map((s) => extractFestivalId(s.trim()))
    .filter(Boolean)
}

export default function FestivalMergeModal({ winnerId, onClose, onMerged }: FestivalMergeModalProps) {
  const [raw, setRaw] = useState('')
  const [merging, setMerging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<MergeResult | null>(null)

  const loserIds = parseLoserIds(raw).filter((id) => id !== winnerId)

  const handleMerge = async () => {
    if (loserIds.length === 0) {
      setError('Paste at least one other festival ID or /festival/ URL to merge into this one')
      return
    }
    setError(null)
    setMerging(true)
    try {
      const merged = await (mergeFestivals(winnerId, loserIds) as unknown as Promise<MergeResult>)
      setResult(merged)
      onMerged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to merge festivals')
    } finally {
      setMerging(false)
    }
  }

  return (
    <Sheet title="Merge duplicate festivals" eyebrow="Admin · festival" onClose={onClose}>
      <div className="form-stack">
        <p className="form-hint">
          Paste the other festival IDs or <code>/festival/&lt;id&gt;</code> URLs that are the same real event as
          this one (one per line, or comma-separated). Their lineup, timetable, genres and any user
          attendance and ratings are copied onto <strong>this</strong> festival, then the other rows are deleted.
          Old links to the merged rows redirect here.
        </p>
        <div>
          <label className="form-label" htmlFor="festival-merge-ids">Festivals to merge into this one</label>
          <textarea
            id="festival-merge-ids"
            className="form-input"
            rows={TEXTAREA_ROWS}
            placeholder={'ra-2312934\npf-482070, pf-490100'}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            autoFocus
            disabled={merging || !!result}
          />
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        {result && (
          <p className="form-hint" role="status">
            Merged {result.mergedLoserIds.length} festival{result.mergedLoserIds.length !== 1 ? 's' : ''} into this one.
            {result.skippedLoserIds.length > 0 && <> Skipped (not found): {result.skippedLoserIds.join(', ')}.</>}
          </p>
        )}
      </div>
      <SheetActions>
        <button type="button" onClick={onClose} className="btn">{result ? 'Close' : 'Cancel'}</button>
        {!result && (
          <button type="button" onClick={handleMerge} onPointerDown={keepKeyboardOpenOnTap} className="btn btn-danger" disabled={merging}>
            {merging ? 'Merging…' : `Merge ${loserIds.length || ''} into this festival`.replace('  ', ' ')}
          </button>
        )}
      </SheetActions>
    </Sheet>
  )
}
