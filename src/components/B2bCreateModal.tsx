'use client'

import { useState } from 'react'
import { keepKeyboardOpenOnTap } from '@/lib/touch-tap'
import Sheet, { SheetActions } from './Sheet'
import styles from './B2bModals.module.css'

const MIN_MEMBER_COUNT = 2
const MAX_MEMBER_COUNT = 10

interface ArtistOption {
  id: string
  name: string
}

interface B2bCreateModalProps {
  initiatingArtist: ArtistOption
  availableArtists: ArtistOption[]
  onSave: (memberArtistIds: string[]) => Promise<void>
  onClose: () => void
}

export default function B2bCreateModal({
  initiatingArtist,
  availableArtists,
  onSave,
  onClose,
}: B2bCreateModalProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filteredArtists = availableArtists.filter((a) =>
    a.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const totalMemberCount = 1 + selectedIds.length
  const canSave = totalMemberCount >= MIN_MEMBER_COUNT
  const isAtMax = totalMemberCount >= MAX_MEMBER_COUNT

  const toggleSelection = (artistId: string) => {
    setSelectedIds((prev) => {
      const isSelected = prev.includes(artistId)
      if (isSelected) return prev.filter((id) => id !== artistId)
      if (isAtMax) return prev
      return [...prev, artistId]
    })
  }

  const previewName = [
    initiatingArtist.name,
    ...selectedIds.map((id) => availableArtists.find((a) => a.id === id)?.name ?? ''),
  ].join(' b2b ')

  const handleSave = async () => {
    if (!canSave) {
      setError('Select at least one other artist')
      return
    }

    setError(null)
    setSaving(true)
    try {
      await onSave([initiatingArtist.id, ...selectedIds])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create B2B')
      setSaving(false)
    }
  }

  return (
    <Sheet title="Create B2B" eyebrow="Admin · lineup" onClose={onClose}>
      <div className="form-stack">
        <div>
          <span className="form-label">Base artist</span>
          <p className={styles.memberName}>{initiatingArtist.name}</p>
        </div>

        <div>
          <label className="form-label" htmlFor="b2b-create-search">
            Add artists {isAtMax ? `(max ${MAX_MEMBER_COUNT} total)` : ''}
          </label>
          <input
            id="b2b-create-search"
            className="form-input"
            placeholder="Search lineup…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
          <div className={`${styles.list} ${styles.scroll}`}>
            {filteredArtists.length === 0 ? (
              <p className="form-hint">No other artists in the lineup.</p>
            ) : (
              filteredArtists.map((artist) => {
                const isSelected = selectedIds.includes(artist.id)
                const isDisabled = isAtMax && !isSelected
                return (
                  <label key={artist.id} className={`${styles.option} ${isDisabled ? styles.optionLocked : ''}`}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={isDisabled}
                      onChange={() => toggleSelection(artist.id)}
                    />
                    {artist.name}
                  </label>
                )
              })
            )}
          </div>
        </div>

        {selectedIds.length > 0 && (
          <div>
            <span className="form-label">Preview</span>
            <p className={styles.memberName}>{previewName}</p>
          </div>
        )}

        {error && <p className="form-error" role="alert">{error}</p>}
      </div>
      <SheetActions>
        <button type="button" onClick={onClose} className="btn">Cancel</button>
        <button type="button" onClick={handleSave} onPointerDown={keepKeyboardOpenOnTap} className="btn btn-primary" disabled={saving || !canSave}>
          {saving ? 'Creating…' : 'Create B2B'}
        </button>
      </SheetActions>
    </Sheet>
  )
}
