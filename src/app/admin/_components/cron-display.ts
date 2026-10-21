import type { CronRunRecord } from '@/db/actions/cron-runs-core'
import { CRON_OVERDUE_HOURS, CRON_RUN_STUCK_MINUTES } from '@/lib/constants'

const MS_PER_SECOND = 1000
const SECONDS_PER_MINUTE = 60
const MS_PER_MINUTE = SECONDS_PER_MINUTE * MS_PER_SECOND
const MS_PER_HOUR = 60 * MS_PER_MINUTE
const MS_PER_DAY = 24 * MS_PER_HOUR

/** cron_runs.status plus "killed": still 'running' long after maxDuration. */
export type RunDisplayStatus = 'running' | 'ok' | 'partial' | 'error' | 'killed'

export function getRunDisplayStatus(run: CronRunRecord, now: Date): RunDisplayStatus {
  const isStuck = now.getTime() - run.startedAt.getTime() > CRON_RUN_STUCK_MINUTES * MS_PER_MINUTE
  if (run.status === 'running' && isStuck) return 'killed'
  return run.status
}

/** The newest run that finished without throwing, or undefined. */
export function findLastCompletedRun(runs: CronRunRecord[]): CronRunRecord | undefined {
  return runs.find(run => run.finishedAt && run.status !== 'error')
}

export function isJobOverdue(runs: CronRunRecord[], now: Date): boolean {
  const last = findLastCompletedRun(runs)
  if (!last) return true
  return now.getTime() - last.startedAt.getTime() > CRON_OVERDUE_HOURS * MS_PER_HOUR
}

export function formatUtc(date: Date): string {
  return date.toLocaleString('en-GB', {
    timeZone: 'UTC', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  }) + ' UTC'
}

export function formatDuration(run: CronRunRecord): string {
  if (!run.finishedAt) return '–'
  const totalSeconds = Math.round((run.finishedAt.getTime() - run.startedAt.getTime()) / MS_PER_SECOND)
  const minutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE)
  const seconds = totalSeconds % SECONDS_PER_MINUTE
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`
}

export function formatAgo(date: Date, now: Date): string {
  const elapsed = now.getTime() - date.getTime()
  if (elapsed < MS_PER_HOUR) return `${Math.max(1, Math.round(elapsed / MS_PER_MINUTE))} min ago`
  if (elapsed < MS_PER_DAY) return `${Math.round(elapsed / MS_PER_HOUR)} h ago`
  return `${Math.round(elapsed / MS_PER_DAY)} d ago`
}

/** Runs that errored or never finished, started within the last `days` days. */
export function countFailedRuns(runs: CronRunRecord[], now: Date, days: number): number {
  const since = now.getTime() - days * MS_PER_DAY
  return runs.filter(run => {
    if (run.startedAt.getTime() < since) return false
    const status = getRunDisplayStatus(run, now)
    return status === 'error' || status === 'killed'
  }).length
}
