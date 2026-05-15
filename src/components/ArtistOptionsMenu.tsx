'use client'

import React from 'react'

const MODAL_Z_INDEX = 1000
const MODAL_MAX_WIDTH = 480

interface ArtistOptionsMenuProps {
  onEditName: () => void
  onSplitB2b: () => void
  onClose: () => void
}

export default function ArtistOptionsMenu({ onEditName, onSplitB2b, onClose }: ArtistOptionsMenuProps) {
  const buttonStyle: React.CSSProperties = {
    width: '100%',
    background: 'none',
    border: 'none',
    borderBottom: '1px solid var(--border)',
    color: 'var(--text-primary)',
    fontSize: '0.95rem',
    fontFamily: 'var(--font-sans)',
    padding: '16px 20px',
    textAlign: 'left',
    cursor: 'pointer',
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
        }}
      >
        <div style={{
          padding: '18px 20px 14px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem' }}>
            Options
          </span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.1rem', cursor: 'pointer', padding: '4px 8px' }}
          >
            &times;
          </button>
        </div>

        <button onClick={onEditName} style={buttonStyle}>
          Edit artist name
        </button>
        <button onClick={onSplitB2b} style={{ ...buttonStyle, borderBottom: 'none' }}>
          Split B2B artist
        </button>

        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)' }}>
          <button onClick={onClose} className="btn btn-secondary" style={{ width: '100%' }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
