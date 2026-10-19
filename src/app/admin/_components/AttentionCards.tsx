import Link from 'next/link'

type Props = {
  pendingDuplicates: number
  /** From the newest maintenance run; null when there is none yet. */
  linkReviewCount: number | null
}

/** Work waiting on an admin. Only the duplicates queue has a page to act on. */
export default function AttentionCards({ pendingDuplicates, linkReviewCount }: Props) {
  return (
    <div className="stats-grid">
      <Link href="/admin/duplicates" className="stat-card stat-card-clickable" style={{ color: 'inherit', textDecoration: 'none' }}>
        <span className="stat-label">Possible duplicates</span>
        <span className="stat-value">{pendingDuplicates}</span>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Pending review →</span>
      </Link>
      <div className="stat-card">
        <span className="stat-label">Timetable links to check</span>
        <span className="stat-value">{linkReviewCount ?? '–'}</span>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Uncertain Partyflock matches in the last maintenance run (count only)
        </span>
      </div>
    </div>
  )
}
