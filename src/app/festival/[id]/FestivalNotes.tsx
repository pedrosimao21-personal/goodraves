'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { keepKeyboardOpenOnTap } from '@/lib/touch-tap'

const SAVED_MESSAGE_DURATION_MS = 2000

export default function FestivalNotes({ eventId, notes, onSave, label = 'Personal Notes', placeholder = 'Add notes about this event...' }: {
  eventId: string
  notes: string
  onSave: (eventId: string, notes: string) => Promise<void>
  label?: string
  placeholder?: string
}) {
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

  // Warn before closing the tab / reloading with unsaved changes, since
  // saving is now an explicit action rather than autosave-as-you-type.
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

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value)
  }

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
    <div style={{ marginTop: 0, flex: 1, minWidth: 200 }}>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
        {label}
        {saving && (
          <span style={{ fontSize: '0.7rem', color: 'var(--accent-green)', fontStyle: 'italic', textTransform: 'none' }}>
            Saving...
          </span>
        )}
        {!saving && justSaved && (
          <span style={{ fontSize: '0.7rem', color: 'var(--accent-green)', fontStyle: 'italic', textTransform: 'none' }}>
            Saved &#10003;
          </span>
        )}
      </div>
      <textarea
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        maxLength={5000}
        rows={1}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          background: 'var(--surface-hover)',
          border: '1px solid var(--border-medium)',
          borderRadius: 8,
          padding: '6px 12px',
          color: 'var(--text-primary)',
          fontSize: '0.85rem',
          resize: 'none',
          fontFamily: 'inherit',
          outline: 'none',
          transition: 'border-color 150ms ease',
        }}
        onFocus={e => e.currentTarget.style.borderColor = 'var(--border-focus)'}
        onBlur={e => e.currentTarget.style.borderColor = 'var(--border-medium)'}
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
        <button
          onClick={handleSave}
          onPointerDown={keepKeyboardOpenOnTap}
          disabled={!isDirty || saving}
          className="btn btn-secondary btn-sm"
          style={{ opacity: (!isDirty || saving) ? 0.5 : 1, cursor: (!isDirty || saving) ? 'default' : 'pointer' }}
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  )
}
