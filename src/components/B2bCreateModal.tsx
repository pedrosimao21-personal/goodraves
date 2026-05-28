'use client'

import React, { useState } from 'react'

const MODAL_Z_INDEX = 1000
const MODAL_MAX_WIDTH = 480
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
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
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
            Create B2B
          </span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.1rem', cursor: 'pointer', padding: '4px 8px' }}
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Initiating artist (fixed) */}
          <div>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 6 }}>
              Base artist
            </span>
            <div style={{
              padding: '10px 12px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: '0.9rem',
              color: 'var(--text-muted)',
            }}>
              {initiatingArtist.name}
            </div>
          </div>

          {/* Search */}
          <div>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 6 }}>
              Add artists {isAtMax ? `(max ${MAX_MEMBER_COUNT} total)` : ''}
            </span>
            <input
              style={inputStyle}
              placeholder="Search lineup..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
          </div>

          {/* Artist list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {filteredArtists.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                No other artists in the lineup.
              </p>
            ) : (
              filteredArtists.map((artist) => {
                const isSelected = selectedIds.includes(artist.id)
                const isDisabled = isAtMax && !isSelected
                return (
                  <button
                    key={artist.id}
                    onClick={() => toggleSelection(artist.id)}
                    disabled={isDisabled}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 12px',
                      background: isSelected ? 'var(--bg-secondary)' : 'none',
                      border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                      borderRadius: 8,
                      color: isDisabled ? 'var(--text-muted)' : 'var(--text-primary)',
                      cursor: isDisabled ? 'default' : 'pointer',
                      textAlign: 'left',
                      fontSize: '0.9rem',
                      fontFamily: 'var(--font-sans)',
                      opacity: isDisabled ? 0.5 : 1,
                    }}
                  >
                    <span style={{
                      width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                      border: `2px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                      background: isSelected ? 'var(--accent)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.7rem', color: 'white',
                    }}>
                      {isSelected && '✓'}
                    </span>
                    {artist.name}
                  </button>
                )
              })
            )}
          </div>

          {/* Preview */}
          {selectedIds.length > 0 && (
            <div style={{
              padding: '10px 12px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 8,
            }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                Preview
              </span>
              <span style={{ fontSize: '0.9rem' }}>{previewName}</span>
            </div>
          )}

          {error && (
            <p style={{ fontSize: '0.82rem', color: '#f87171', margin: 0 }}>{error}</p>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, flexShrink: 0 }}>
          <button onClick={onClose} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
          <button onClick={handleSave} className="btn btn-primary" style={{ flex: 2 }} disabled={saving || !canSave}>
            {saving ? 'Creating...' : 'Create B2B'}
          </button>
        </div>
      </div>
    </div>
  )
}
