'use client'

import { useEffect, useState, useRef, useCallback } from 'react'

const DEBOUNCE_SAVE_MS = 600

export default function FestivalNotes({ eventId, notes, onSave }: {
  eventId: string
  notes: string
  onSave: (eventId: string, notes: string) => Promise<void>
}) {
  const [value, setValue] = useState(notes)
  const [saving, setSaving] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { setValue(notes) }, [notes])

  const debouncedSave = useCallback((text: string) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      setSaving(true)
      await onSave(eventId, text)
      setSaving(false)
    }, DEBOUNCE_SAVE_MS)
  }, [eventId, onSave])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value
    setValue(text)
    debouncedSave(text)
  }

  return (
    <div style={{ marginTop: 0, flex: 1, minWidth: 200 }}>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
        Notes
        {saving && <span style={{ fontSize: '0.7rem', color: 'var(--accent-green)', fontStyle: 'italic', textTransform: 'none' }}>Saving...</span>}
      </div>
      <textarea
        value={value}
        onChange={handleChange}
        placeholder="Add notes about this event..."
        maxLength={5000}
        rows={1}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 8,
          padding: '6px 12px',
          color: 'var(--text-primary)',
          fontSize: '0.85rem',
          resize: 'none',
          fontFamily: 'inherit',
          outline: 'none',
          transition: 'border-color 150ms ease',
        }}
        onFocus={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'}
        onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
      />
    </div>
  )
}
