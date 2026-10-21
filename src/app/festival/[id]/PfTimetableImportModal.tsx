'use client'

import { useState } from 'react'
import { importPFTimetableForFestival, type PFTimetableImportResult } from '@/db/actions/festivals'
import { keepKeyboardOpenOnTap } from '@/lib/touch-tap'
import Sheet, { SheetActions } from '@/components/Sheet'

interface PfTimetableImportModalProps {
  festivalId: string
  onClose: () => void
  onImported: () => void
}

export default function PfTimetableImportModal({ festivalId, onClose, onImported }: PfTimetableImportModalProps) {
  const [url, setUrl] = useState('')
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<PFTimetableImportResult | null>(null)

  const handleImport = async () => {
    if (!url.trim()) {
      setError('Paste a Partyflock event or party URL')
      return
    }
    setError(null)
    setImporting(true)
    try {
      const imported = await (importPFTimetableForFestival(festivalId, url.trim()) as unknown as Promise<PFTimetableImportResult>)
      setResult(imported)
      onImported()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import timetable')
    } finally {
      setImporting(false)
    }
  }

  return (
    <Sheet title="Link Partyflock timetable" eyebrow="Admin · festival" onClose={onClose}>
      <div className="form-stack">
        <p className="form-hint">
          Paste the Partyflock event or party page for this festival. Its date must match this
          festival&apos;s date, so the wrong edition&apos;s timetable can&apos;t be attached.
        </p>
        <div>
          <label className="form-label" htmlFor="pf-timetable-url">Partyflock URL</label>
          <input
            id="pf-timetable-url"
            className="form-input"
            placeholder="https://partyflock.nl/party/123:festival-name"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            autoFocus
            disabled={importing || !!result}
          />
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        {result && (
          <p className="form-hint" role="status">
            Imported {result.slotCount} slot{result.slotCount !== 1 ? 's' : ''} across{' '}
            {result.stageCount} stage{result.stageCount !== 1 ? 's' : ''}
            {result.newArtistCount > 0 && ` (added ${result.newArtistCount} new artist${result.newArtistCount !== 1 ? 's' : ''} to the lineup)`}.
          </p>
        )}
      </div>
      <SheetActions>
        <button type="button" onClick={onClose} className="btn">{result ? 'Close' : 'Cancel'}</button>
        {!result && (
          <button type="button" onClick={handleImport} onPointerDown={keepKeyboardOpenOnTap} className="btn btn-primary" disabled={importing}>
            {importing ? 'Importing…' : 'Import timetable'}
          </button>
        )}
      </SheetActions>
    </Sheet>
  )
}
