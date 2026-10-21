'use client'

import { useState } from 'react'
import { keepKeyboardOpenOnTap } from '@/lib/touch-tap'
import Sheet, { SheetActions } from './Sheet'

interface ArtistRenameModalProps {
  artistName: string
  onSave: (newName: string) => Promise<void>
  onClose: () => void
}

export default function ArtistRenameModal({ artistName, onSave, onClose }: ArtistRenameModalProps) {
  const [name, setName] = useState(artistName)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const trimmedName = name.trim()
  const isUnchanged = trimmedName.toLowerCase() === artistName.toLowerCase()
  const isValid = trimmedName.length > 0 && !isUnchanged

  const handleSave = async () => {
    if (!isValid) return

    setError(null)
    setSaving(true)
    try {
      await onSave(trimmedName)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename artist')
      setSaving(false)
    }
  }

  return (
    <Sheet title="Edit artist name" eyebrow="Admin · lineup" onClose={onClose}>
      <div className="form-stack">
        <p className="form-hint">
          Rename &quot;{artistName}&quot;. If an artist with the new name already exists, they will be merged.
        </p>
        <div>
          <label className="form-label" htmlFor="artist-rename-input">Artist name</label>
          <input
            id="artist-rename-input"
            className="form-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
            placeholder="Artist name"
            autoFocus
          />
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
      </div>
      <SheetActions>
        <button type="button" onClick={onClose} className="btn">Cancel</button>
        <button type="button" onClick={handleSave} onPointerDown={keepKeyboardOpenOnTap} className="btn btn-primary" disabled={saving || !isValid}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </SheetActions>
    </Sheet>
  )
}
