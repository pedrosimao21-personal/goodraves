'use client'

import { useState } from 'react'
import Link from 'next/link'
import { dismissDuplicate, mergeDuplicate, type DuplicateCandidate } from '@/db/actions/festival-duplicates'
import { formatDateRange } from '@/lib/format-date'

type Side = DuplicateCandidate['a']

function pairId(c: DuplicateCandidate): string {
  return `${c.a.id}|${c.b.id}`
}

function SideSummary({ side, isKept, onKeep }: { side: Side; isKept: boolean; onKeep: () => void }) {
  return (
    <label
      className="dashboard-card"
      style={{ flex: '1 1 260px', minWidth: 0, cursor: 'pointer', outline: isKept ? '2px solid var(--border-hover)' : 'none' }}
    >
      <input type="radio" checked={isKept} onChange={onKeep} style={{ marginRight: 8 }} />
      <strong>Keep this one</strong>
      <div style={{ marginTop: 8 }}>
        <Link href={`/festival/${side.id}`} target="_blank" style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>
          {side.name}
        </Link>
      </div>
      <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: 4 }}>
        {formatDateRange(side.date, side.endDate ?? undefined)} · {[side.venue, side.location].filter(Boolean).join(', ') || 'no location'}
      </div>
      <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 4 }}>
        {side.source ?? 'unknown source'} · {side.artistCount} artists · {side.slotCount} timetable slots · {side.attendeeCount} users
      </div>
    </label>
  )
}

function CandidateRow({ candidate, onResolved }: { candidate: DuplicateCandidate; onResolved: (id: string) => void }) {
  const [winnerId, setWinnerId] = useState(candidate.suggestedWinnerId)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const loserId = winnerId === candidate.a.id ? candidate.b.id : candidate.a.id

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await action()
      onResolved(pairId(candidate))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setBusy(false)
    }
  }

  return (
    <div style={{ marginBottom: 32 }}>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 8 }}>Why: {candidate.reason}</p>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <SideSummary side={candidate.a} isKept={winnerId === candidate.a.id} onKeep={() => setWinnerId(candidate.a.id)} />
        <SideSummary side={candidate.b} isKept={winnerId === candidate.b.id} onKeep={() => setWinnerId(candidate.b.id)} />
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
        <button className="btn btn-primary" disabled={busy} onClick={() => run(() => mergeDuplicate(winnerId, loserId) as unknown as Promise<void>)}>
          Merge
        </button>
        <button className="btn btn-secondary" disabled={busy} onClick={() => run(() => dismissDuplicate(candidate.a.id, candidate.b.id) as unknown as Promise<void>)}>
          Not the same event
        </button>
      </div>
      {error && <p style={{ color: 'var(--danger, #ef4444)', marginTop: 8 }}>{error}</p>}
    </div>
  )
}

export default function DuplicatesReview({ initialCandidates }: { initialCandidates: DuplicateCandidate[] }) {
  const [candidates, setCandidates] = useState(initialCandidates)

  if (candidates.length === 0) {
    return (
      <div className="empty-state">
        <h3>Nothing to review</h3>
        <p>The daily duplicate check will add pairs here when it finds any.</p>
      </div>
    )
  }

  return (
    <div>
      {candidates.map((c) => (
        <CandidateRow key={pairId(c)} candidate={c} onResolved={(id) => setCandidates((prev) => prev.filter((p) => pairId(p) !== id))} />
      ))}
    </div>
  )
}
