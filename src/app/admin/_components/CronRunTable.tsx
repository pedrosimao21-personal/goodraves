import type { CronRunRecord } from '@/db/actions/cron-runs-core'
import StatusBadge from './StatusBadge'
import { formatDuration, formatUtc, getRunDisplayStatus } from './cron-display'
import { listRunErrors, type MetricColumn } from './cron-metrics'

const CELL_STYLE = { padding: '8px 12px', borderBottom: '1px solid var(--border)', textAlign: 'left' as const, whiteSpace: 'nowrap' as const }
const HEADER_STYLE = { ...CELL_STYLE, color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' as const }

function RunErrors({ run }: { run: CronRunRecord }) {
  const errors = listRunErrors(run)
  if (errors.length === 0) return null
  return (
    <details>
      <summary style={{ cursor: 'pointer', color: 'var(--error-text)' }}>{errors.length} error{errors.length === 1 ? '' : 's'}</summary>
      <ul style={{ margin: '8px 0 0', paddingLeft: 18, whiteSpace: 'normal', maxWidth: 480, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
        {errors.map((error, i) => <li key={i} style={{ overflowWrap: 'anywhere' }}>{error}</li>)}
      </ul>
    </details>
  )
}

function RunRow({ run, columns, now }: { run: CronRunRecord; columns: MetricColumn[]; now: Date }) {
  return (
    <tr>
      <td style={CELL_STYLE}>{formatUtc(run.startedAt)}</td>
      <td style={CELL_STYLE}><StatusBadge status={getRunDisplayStatus(run, now)} /></td>
      <td style={CELL_STYLE}>{formatDuration(run)}</td>
      {columns.map(column => (
        <td key={column.label} style={{ ...CELL_STYLE, textAlign: 'right' }}>
          {run.summary ? column.read(run.summary) : '–'}
        </td>
      ))}
      <td style={CELL_STYLE}><RunErrors run={run} /></td>
    </tr>
  )
}

export default function CronRunTable({ runs, columns, now }: { runs: CronRunRecord[]; columns: MetricColumn[]; now: Date }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
        <thead>
          <tr>
            <th style={HEADER_STYLE}>Started</th>
            <th style={HEADER_STYLE}>Status</th>
            <th style={HEADER_STYLE}>Took</th>
            {columns.map(column => (
              <th key={column.label} title={column.title} style={{ ...HEADER_STYLE, textAlign: 'right', cursor: 'help' }}>
                {column.label}
              </th>
            ))}
            <th style={HEADER_STYLE}>Errors</th>
          </tr>
        </thead>
        <tbody>
          {runs.map(run => <RunRow key={run.id} run={run} columns={columns} now={now} />)}
        </tbody>
      </table>
    </div>
  )
}
