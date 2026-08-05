'use client'

import { useState } from 'react'
import { mergeFestivals, type MergeResult } from '@/db/actions/festivals'

const MODAL_Z_INDEX = 1000
const MODAL_MAX_WIDTH = 480

interface FestivalMergeModalProps {
  /** The festival currently being viewed — becomes the merge winner. */
  winnerId: string
  onClose: () => void
  onMerged: () => void
}

/** Pull a festival id out of a pasted /festival/<id> URL, or return the input as-is. */
function extractFestivalId(input: string): string {
  const match = input.match(/\/festival\/([a-z0-9-]+)/i)
  return match ? match[1] : input
}

function parseLoserIds(raw: string): string[] {
  return raw
    .split(/[\n,]/)
    .map((s) => extractFestivalId(s.trim()))
    .filter(Boolean)
}

export default function FestivalMergeModal({ winnerId, onClose, onMerged }: FestivalMergeModalProps) {
  const [raw, setRaw] = useState('')
  const [merging, setMerging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<MergeResult | null>(null)

  const loserIds = parseLoserIds(raw).filter((id) => id !== winnerId)

  const handleMerge = async () => {
    if (loserIds.length === 0) {
      setError('Paste at least one other festival ID or /festival/ URL to merge into this one')
      return
    }
    setError(null)
    setMerging(true)
    try {
      const merged = await (mergeFestivals(winnerId, loserIds) as unknown as Promise<MergeResult>)
      setResult(merged)
      onMerged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to merge festivals')
    } finally {
      setMerging(false)
    }
  }

  const textareaStyle: React.CSSProperties = {
    width: '100%',
    minHeight: 80,
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '10px 12px',
    color: 'var(--text-primary)',
    fontSize: '0.9rem',
    fontFamily: 'var(--font-sans)',
    outline: 'none',
    boxSizing: 'border-box',
    resize: 'vertical',
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
            Merge Duplicate Festivals
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
            Paste the other festival ID(s) or <code>/festival/&lt;id&gt;</code> URLs that are the
            same real event as this one (one per line, or comma-separated). Their lineup,
            timetable, genres, and any user attendance/ratings are copied onto <strong>this</strong>{' '}
            festival, then the other rows are deleted. This is destructive but recorded — old
            links to the merged rows will redirect here.
          </p>

          <textarea
            style={textareaStyle}
            placeholder={'ra-2312934\npf-482070, pf-490100'}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            autoFocus
            disabled={merging || !!result}
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
              Merged {result.mergedLoserIds.length} festival{result.mergedLoserIds.length !== 1 ? 's' : ''} into this one.
              {result.skippedLoserIds.length > 0 && (
                <> Skipped (not found): {result.skippedLoserIds.join(', ')}.</>
              )}
            </div>
          )}
        </div>

        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10 }}>
          <button onClick={onClose} className="btn btn-secondary" style={{ flex: 1 }}>
            {result ? 'Close' : 'Cancel'}
          </button>
          {!result && (
            <button
              onClick={handleMerge}
              className="btn btn-primary"
              style={{ flex: 2, background: 'var(--accent-red)', borderColor: 'var(--accent-red)' }}
              disabled={merging}
            >
              {merging ? 'Merging…' : `Merge ${loserIds.length || ''} into this festival`.trim()}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
