import type { CronRunRecord } from '@/db/actions/cron-runs-core'
import StatusBadge from './StatusBadge'
import { formatDuration, formatUtc, getRunDisplayStatus } from './cron-display'
import { listRunErrors, type MetricColumn } from './cron-metrics'
import styles from './Admin.module.css'

function RunErrors({ run }: { run: CronRunRecord }) {
  const errors = listRunErrors(run)
  if (errors.length === 0) return <span className={`mono ${styles.muted}`}>None</span>
  return (
    <details className={styles.errors}>
      <summary className="mono">{errors.length} error{errors.length === 1 ? '' : 's'} · show</summary>
      <ul className={styles.errorList}>
        {errors.map((error, i) => <li key={i}>{error}</li>)}
      </ul>
    </details>
  )
}

function RunRow({ run, columns, now }: { run: CronRunRecord; columns: MetricColumn[]; now: Date }) {
  return (
    <tr>
      <td className={styles.numeric}>{formatUtc(run.startedAt)}</td>
      <td><StatusBadge status={getRunDisplayStatus(run, now)} /></td>
      <td className={styles.numeric}>{formatDuration(run)}</td>
      {columns.map(column => (
        <td key={column.label} className={styles.numeric}>{run.summary ? column.read(run.summary) : '–'}</td>
      ))}
      <td><RunErrors run={run} /></td>
    </tr>
  )
}

export default function CronRunTable({ runs, columns, now }: { runs: CronRunRecord[]; columns: MetricColumn[]; now: Date }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Started</th>
            <th>Status</th>
            <th>Took</th>
            {columns.map(column => <th key={column.label} title={column.title}>{column.label}</th>)}
            <th>Errors</th>
          </tr>
        </thead>
        <tbody>
          {runs.map(run => <RunRow key={run.id} run={run} columns={columns} now={now} />)}
        </tbody>
      </table>
    </div>
  )
}
