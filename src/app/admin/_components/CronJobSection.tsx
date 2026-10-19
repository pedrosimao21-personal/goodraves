import type { CronJobHistory } from '@/db/actions/admin-dashboard-core'
import { CRON_OVERDUE_HOURS } from '@/lib/constants'
import CronRunTable from './CronRunTable'
import StatusBadge from './StatusBadge'
import { formatAgo, formatDuration, getRunDisplayStatus, isJobOverdue } from './cron-display'
import { METRIC_COLUMNS } from './cron-metrics'

function LastRunLine({ job, now }: { job: CronJobHistory; now: Date }) {
  const [last] = job.runs
  if (!last) return <p style={{ color: 'var(--text-muted)' }}>No runs recorded yet.</p>
  return (
    <p style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', color: 'var(--text-secondary)' }}>
      <StatusBadge status={getRunDisplayStatus(last, now)} />
      {last.finishedAt
        ? `Last run ${formatAgo(last.startedAt, now)}, took ${formatDuration(last)}`
        : `Last run started ${formatAgo(last.startedAt, now)}, not finished`}
    </p>
  )
}

export default function CronJobSection({ job, now }: { job: CronJobHistory; now: Date }) {
  const isOverdue = job.runs.length > 0 && isJobOverdue(job.runs, now)
  return (
    <section className="stat-card" style={{ marginBottom: 24, gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <h3 style={{ fontSize: '1.15rem', margin: 0 }}>{job.label}</h3>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{job.id} · {job.schedule}</span>
      </div>
      <LastRunLine job={job} now={now} />
      {isOverdue && (
        <p style={{ color: 'var(--error-text)', fontSize: '0.9rem' }}>
          No completed run in the last {CRON_OVERDUE_HOURS} hours. Check the Vercel Cron logs.
        </p>
      )}
      {job.runs.length > 0 && <CronRunTable runs={job.runs} columns={METRIC_COLUMNS[job.id]} now={now} />}
    </section>
  )
}
