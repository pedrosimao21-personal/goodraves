'use client'

import { useState } from 'react'
import { importPFTimetableForFestival, type PFTimetableImportResult } from '@/db/actions/festivals'
import { keepKeyboardOpenOnTap } from '@/lib/touch-tap'

const MODAL_Z_INDEX = 1000
const MODAL_MAX_WIDTH = 480

interface PfTimetableImportModalProps {
  festivalId: string
  onClose: () => void
  onImported: () => void
}

export default function PfTimetableImportModal({ festivalId, onClose, onImported }: PfTimetableImportModalProps) {
  const [url, setUrl] = useState('')
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<PFTimetableImportResult | null>(null)

  const handleImport = async () => {
    if (!url.trim()) {
      setError('Paste a Partyflock event or party URL')
      return
    }
    setError(null)
    setImporting(true)
    try {
      const imported = await (importPFTimetableForFestival(festivalId, url.trim()) as unknown as Promise<PFTimetableImportResult>)
      setResult(imported)
      onImported()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import timetable')
    } finally {
      setImporting(false)
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
        background: 'var(--overlay-scrim)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
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
        }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem' }}>
            Link Partyflock Timetable
          </span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.1rem', cursor: 'pointer', padding: '4px 8px' }}
          >
            &times;
          </button>
        </div>

        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
            Paste the Partyflock event or party page for this festival. The date must match
            this festival&apos;s date — imports are rejected otherwise, to avoid attaching the
            wrong edition&apos;s timetable.
          </p>

          <input
            style={inputStyle}
            placeholder="https://partyflock.nl/party/123:festival-name"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            autoFocus
            disabled={importing || !!result}
          />

          {error && (
            <p style={{ fontSize: '0.82rem', color: 'var(--error-text)', margin: 0 }}>{error}</p>
          )}

          {result && (
            <div style={{
              padding: '10px 12px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: '0.85rem',
              color: 'var(--accent-green)',
            }}>
              Imported {result.slotCount} slot{result.slotCount !== 1 ? 's' : ''} across{' '}
              {result.stageCount} stage{result.stageCount !== 1 ? 's' : ''}
              {result.newArtistCount > 0 && ` (added ${result.newArtistCount} new artist${result.newArtistCount !== 1 ? 's' : ''} to the lineup)`}.
            </div>
          )}
        </div>

        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10 }}>
          <button onClick={onClose} className="btn btn-secondary" style={{ flex: 1 }}>
            {result ? 'Close' : 'Cancel'}
          </button>
          {!result && (
            <button onClick={handleImport} onPointerDown={keepKeyboardOpenOnTap} className="btn btn-primary" style={{ flex: 2 }} disabled={importing}>
              {importing ? 'Importing…' : 'Import Timetable'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
