import type { CronJobHistory } from '@/db/actions/admin-dashboard-core'
import { CRON_OVERDUE_HOURS } from '@/lib/constants'
import CronRunTable from './CronRunTable'
import StatusBadge from './StatusBadge'
import { formatAgo, formatDuration, getRunDisplayStatus, isJobOverdue } from './cron-display'
import { METRIC_COLUMNS } from './cron-metrics'
import styles from './Admin.module.css'

function LastRunLine({ job, now }: { job: CronJobHistory; now: Date }) {
  const [last] = job.runs
  if (!last) return <p className={`mono ${styles.muted}`}>No runs recorded yet</p>
  return (
    <p className={`mono ${styles.lastRun}`}>
      <StatusBadge status={getRunDisplayStatus(last, now)} />
      {last.finishedAt
        ? `Last run ${formatAgo(last.startedAt, now)} · took ${formatDuration(last)}`
        : `Last run started ${formatAgo(last.startedAt, now)} · not finished`}
    </p>
  )
}

export default function CronJobSection({ job, now }: { job: CronJobHistory; now: Date }) {
  const isOverdue = job.runs.length > 0 && isJobOverdue(job.runs, now)
  return (
    <section className={styles.job}>
      <div className={styles.jobHeader}>
        <h3 className={styles.jobTitle}>{job.label}<span className={`mono ${styles.jobId}`}>{job.id} · {job.schedule}</span></h3>
        <LastRunLine job={job} now={now} />
      </div>
      {isOverdue && (
        <p className={styles.overdue}>No completed run in the last {CRON_OVERDUE_HOURS} hours. Check the Vercel Cron logs.</p>
      )}
      {job.runs.length > 0 && <CronRunTable runs={job.runs} columns={METRIC_COLUMNS[job.id]} now={now} />}
    </section>
  )
}
