'use client'

import { useState } from 'react'
import Link from 'next/link'
import { dismissDuplicate, mergeDuplicate, type DuplicateCandidate } from '@/db/actions/festival-duplicates'
import { formatDateRange } from '@/lib/format-date'
import styles from './Duplicates.module.css'

type Side = DuplicateCandidate['a']

function pairId(c: DuplicateCandidate): string {
  return `${c.a.id}|${c.b.id}`
}

function SideOption({ side, groupName, isKept, onKeep }: { side: Side; groupName: string; isKept: boolean; onKeep: () => void }) {
  const place = [side.venue, side.location].filter(Boolean).join(', ') || 'no location'
  return (
    <label className={`${styles.side} ${isKept ? styles.sideKept : ''}`}>
      <input type="radio" name={groupName} checked={isKept} onChange={onKeep} />
      <span className={styles.sideInfo}>
        <span className={styles.sideTitle}>
          <Link href={`/festival/${side.id}`} target="_blank" className={styles.sideName}>{side.name}</Link>
          <span className={`mono ${styles.muted}`}>{side.id}</span>
        </span>
        <span className={`mono ${styles.sideMeta}`}>{formatDateRange(side.date, side.endDate ?? undefined)} · {place}</span>
        <span className={`mono ${styles.sideMeta}`}>
          {side.source ?? 'unknown source'} · {side.artistCount} artists · {side.slotCount} slots · {side.attendeeCount} users
        </span>
        <span className={`mono ${styles.sideKeep}`}>{isKept ? 'Keep this one' : 'Merge into the other'}</span>
      </span>
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
    <fieldset className={styles.pair}>
      <legend className={`mono ${styles.why}`}>Why: {candidate.reason}</legend>
      <div className={styles.sides}>
        {[candidate.a, candidate.b].map(side => (
          <SideOption
            key={side.id}
            side={side}
            groupName={pairId(candidate)}
            isKept={winnerId === side.id}
            onKeep={() => setWinnerId(side.id)}
          />
        ))}
      </div>
      <div className={styles.actions}>
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => run(() => mergeDuplicate(winnerId, loserId) as unknown as Promise<void>)}>
          Merge
        </button>
        <button type="button" className="btn" disabled={busy} onClick={() => run(() => dismissDuplicate(candidate.a.id, candidate.b.id) as unknown as Promise<void>)}>
          Not a duplicate
        </button>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </fieldset>
  )
}

export default function DuplicatesReview({ initialCandidates }: { initialCandidates: DuplicateCandidate[] }) {
  const [candidates, setCandidates] = useState(initialCandidates)

  if (candidates.length === 0) {
    return (
      <div className={styles.empty}>
        <h2 className={`display ${styles.emptyTitle}`}>Nothing to review.</h2>
        <p className={styles.muted}>The daily duplicate check adds pairs here when it finds any.</p>
      </div>
    )
  }

  return (
    <div className={styles.list}>
      {candidates.map((c) => (
        <CandidateRow key={pairId(c)} candidate={c} onResolved={(id) => setCandidates((prev) => prev.filter((p) => pairId(p) !== id))} />
      ))}
    </div>
  )
}
