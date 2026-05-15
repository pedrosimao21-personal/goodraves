'use client'

import React, { useState } from 'react'

const MODAL_Z_INDEX = 1000
const MODAL_MAX_WIDTH = 480

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
            Edit Artist Name
          </span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.1rem', cursor: 'pointer', padding: '4px 8px' }}
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
            Rename &quot;{artistName}&quot;. If an artist with the new name already exists, they will be merged.
          </p>

          <div>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 5, display: 'block', fontWeight: 600 }}>
              Artist name
            </label>
            <input
              style={inputStyle}
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
              placeholder="Artist name"
              autoFocus
            />
          </div>

          {error && (
            <p style={{ fontSize: '0.82rem', color: '#f87171', margin: 0 }}>{error}</p>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, flexShrink: 0 }}>
          <button onClick={onClose} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
          <button onClick={handleSave} className="btn btn-primary" style={{ flex: 2 }} disabled={saving || !isValid}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
