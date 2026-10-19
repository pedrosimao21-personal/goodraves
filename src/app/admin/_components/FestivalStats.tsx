import type { SourceCount } from '@/db/actions/admin-dashboard-core'

const CELL_STYLE = { padding: '8px 12px', borderBottom: '1px solid var(--border)', textAlign: 'right' as const }
const HEADER_STYLE = { ...CELL_STYLE, color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' as const }

type Props = { sources: SourceCount[]; mergedRecently: number; recentDays: number }

/** Festival counts straight from our own tables, independent of cron history. */
export default function FestivalStats({ sources, mergedRecently, recentDays }: Props) {
  const total = sources.reduce((sum, row) => sum + row.total, 0)
  const recent = sources.reduce((sum, row) => sum + row.recent, 0)
  return (
    <section className="stat-card" style={{ gap: 12 }}>
      <p style={{ color: 'var(--text-secondary)' }}>
        {total} festivals in total. In the last {recentDays} days: {recent} added, {mergedRecently} merged away as duplicates.
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <thead>
            <tr>
              <th style={{ ...HEADER_STYLE, textAlign: 'left' }}>Source</th>
              <th style={HEADER_STYLE}>Total</th>
              <th style={HEADER_STYLE}>Added, last {recentDays} days</th>
            </tr>
          </thead>
          <tbody>
            {sources.map(row => (
              <tr key={row.source}>
                <td style={{ ...CELL_STYLE, textAlign: 'left' }}>{row.source}</td>
                <td style={CELL_STYLE}>{row.total}</td>
                <td style={CELL_STYLE}>{row.recent}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
