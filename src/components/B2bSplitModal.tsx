'use client'

import React, { useState } from 'react'

const MODAL_Z_INDEX = 1000
const MODAL_MAX_WIDTH = 480
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
    setFields(prev => prev.map((f, i) => (i === index ? value : f)))
  }

  const addField = () => {
    if (!canAddField) return
    setFields(prev => [...prev, ''])
  }

  const removeField = (index: number) => {
    if (!canRemoveField) return
    setFields(prev => prev.filter((_, i) => i !== index))
  }

  const handleSave = async () => {
    const trimmed = fields.map(f => f.trim()).filter(Boolean)
    if (trimmed.length < MIN_FIELDS) {
      setError('Enter at least 2 artist names')
      return
    }

    const uniqueCheck = new Set(trimmed.map(n => n.toLowerCase()))
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

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '10px 12px',
    color: 'var(--text-primary)',
    fontSize: '0.9rem',
    fontFamily: 'var(--font-sans)',
    outline: 'none',
    boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: '0.78rem',
    color: 'var(--text-muted)',
    marginBottom: 5,
    display: 'block',
    fontWeight: 600,
  }

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: MODAL_Z_INDEX,
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-end',
        justifyContent: 'center',
        padding: '0 0 env(safe-area-inset-bottom, 0)',
      }}
    >
      <div
        className="fade-in"
        style={{
          background: 'var(--bg-card)',
          width: '100%', maxWidth: MODAL_MAX_WIDTH,
          borderRadius: '20px 20px 0 0',
          border: '1px solid var(--border)',
          overflow: 'hidden',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '18px 20px 14px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem' }}>
            Split B2B Artist
          </span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.1rem', cursor: 'pointer', padding: '4px 8px' }}
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
            Split &quot;{artistName}&quot; into individual artists.
          </p>

          {fields.map((value, idx) => (
            <div key={idx}>
              <label style={labelStyle}>Artist {idx + 1}</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  style={inputStyle}
                  value={value}
                  onChange={e => updateField(idx, e.target.value)}
                  placeholder={`Artist name`}
                  autoFocus={idx === 1}
                />
                {canRemoveField && (
                  <button
                    onClick={() => removeField(idx)}
                    style={{
                      background: 'none', border: '1px solid var(--border)',
                      borderRadius: 8, color: 'var(--text-muted)',
                      cursor: 'pointer', padding: '8px 12px',
                      fontSize: '1rem', lineHeight: 1, flexShrink: 0,
                    }}
                    title="Remove"
                  >
                    -
                  </button>
                )}
              </div>
            </div>
          ))}

          {canAddField && (
            <button
              onClick={addField}
              style={{
                background: 'none', border: '1px dashed var(--border)',
                borderRadius: 8, color: 'var(--text-muted)',
                cursor: 'pointer', padding: '10px',
                fontSize: '0.85rem', width: '100%',
              }}
            >
              + Add another artist
            </button>
          )}

          {error && (
            <p style={{ fontSize: '0.82rem', color: '#f87171', margin: 0 }}>{error}</p>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, flexShrink: 0 }}>
          <button onClick={onClose} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
          <button onClick={handleSave} className="btn btn-primary" style={{ flex: 2 }} disabled={saving}>
            {saving ? 'Splitting...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
