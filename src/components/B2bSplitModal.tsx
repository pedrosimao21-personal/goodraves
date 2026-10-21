'use client'

import { useState } from 'react'
import { keepKeyboardOpenOnTap } from '@/lib/touch-tap'
import Sheet, { SheetActions } from './Sheet'
import { CloseIcon, PlusIcon } from './icons'
import styles from './B2bModals.module.css'

const MIN_FIELDS = 2
const MAX_FIELDS = 10

interface B2bSplitModalProps {
  artistName: string
  onSave: (memberNames: string[]) => Promise<void>
  onClose: () => void
}

export default function B2bSplitModal({ artistName, onSave, onClose }: B2bSplitModalProps) {
  const [fields, setFields] = useState<string[]>([artistName, ''])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canAddField = fields.length < MAX_FIELDS
  const canRemoveField = fields.length > MIN_FIELDS

  const updateField = (index: number, value: string) => {
    setFields((prev) => prev.map((f, i) => (i === index ? value : f)))
  }

  const addField = () => {
    if (!canAddField) return
    setFields((prev) => [...prev, ''])
  }

  const removeField = (index: number) => {
    if (!canRemoveField) return
    setFields((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSave = async () => {
    const trimmed = fields.map((f) => f.trim()).filter(Boolean)
    if (trimmed.length < MIN_FIELDS) {
      setError('Enter at least 2 artist names')
      return
    }

    const uniqueCheck = new Set(trimmed.map((n) => n.toLowerCase()))
    if (uniqueCheck.size !== trimmed.length) {
      setError('Artist names must be unique')
      return
    }

    setError(null)
    setSaving(true)
    try {
      await onSave(trimmed)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to split artist')
      setSaving(false)
    }
  }

  return (
    <Sheet title="Split B2B artist" eyebrow="Admin · lineup" onClose={onClose}>
      <div className="form-stack">
        <p className="form-hint">Split &quot;{artistName}&quot; into individual artists.</p>

        {fields.map((value, idx) => (
          <div key={idx}>
            <label className="form-label" htmlFor={`b2b-split-${idx}`}>Artist {idx + 1}</label>
            <div className={styles.row}>
              <input
                id={`b2b-split-${idx}`}
                className="form-input"
                value={value}
                onChange={(e) => updateField(idx, e.target.value)}
                placeholder="Artist name"
                autoFocus={idx === 1}
              />
              {canRemoveField && (
                <button type="button" className="btn-icon" onClick={() => removeField(idx)} aria-label={`Remove artist ${idx + 1}`}>
                  <CloseIcon size={18} />
                </button>
              )}
            </div>
          </div>
        ))}

        {canAddField && (
          <button type="button" className={`btn ${styles.addButton}`} onClick={addField}>
            <PlusIcon size={16} />Add another artist
          </button>
        )}

        {error && <p className="form-error" role="alert">{error}</p>}
      </div>
      <SheetActions>
        <button type="button" onClick={onClose} className="btn">Cancel</button>
        <button type="button" onClick={handleSave} onPointerDown={keepKeyboardOpenOnTap} className="btn btn-primary" disabled={saving}>
          {saving ? 'Splitting…' : 'Split'}
        </button>
      </SheetActions>
    </Sheet>
  )
}
