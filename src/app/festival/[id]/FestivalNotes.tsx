'use client'

import { useEffect, useState, useRef, useCallback, useId } from 'react'
import { keepKeyboardOpenOnTap } from '@/lib/touch-tap'
import styles from './FestivalYourNight.module.css'

const SAVED_MESSAGE_DURATION_MS = 2000
const NOTES_MAX_LENGTH = 5000
const DEFAULT_ROWS = 3

export default function FestivalNotes({ eventId, notes, onSave, label, placeholder, rows = DEFAULT_ROWS }: {
  eventId: string
  notes: string
  onSave: (eventId: string, notes: string) => Promise<void>
  label: string
  placeholder: string
  rows?: number
}) {
  const fieldId = useId()
  const [value, setValue] = useState(notes)
  const [savedValue, setSavedValue] = useState(notes)
  const [saving, setSaving] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const savedMessageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setValue(notes)
    setSavedValue(notes)
  }, [notes])

  const isDirty = value !== savedValue

  // Saving is an explicit action, so warn before closing the tab or
  // reloading with unsaved changes.
  useEffect(() => {
    if (!isDirty) return
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty])

  useEffect(() => {
    return () => {
      if (savedMessageTimerRef.current) clearTimeout(savedMessageTimerRef.current)
    }
  }, [])

  const handleSave = useCallback(async () => {
    setSaving(true)
    await onSave(eventId, value)
    setSaving(false)
    setSavedValue(value)
    setJustSaved(true)
    if (savedMessageTimerRef.current) clearTimeout(savedMessageTimerRef.current)
    savedMessageTimerRef.current = setTimeout(() => setJustSaved(false), SAVED_MESSAGE_DURATION_MS)
  }, [eventId, value, onSave])

  return (
    <div>
      <label className={`mono ${styles.label}`} htmlFor={fieldId}>{label}</label>
      <textarea
        id={fieldId}
        className="form-input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        maxLength={NOTES_MAX_LENGTH}
        rows={rows}
      />
      <div className={styles.noteFooter}>
        <span className={`mono ${styles.saveStatus}`} aria-live="polite">
          {saving ? 'Saving…' : justSaved ? 'Saved' : ''}
        </span>
        <button
          type="button"
          onClick={handleSave}
          onPointerDown={keepKeyboardOpenOnTap}
          disabled={!isDirty || saving}
          className="btn btn-sm"
        >
          Save
        </button>
      </div>
    </div>
  )
}
