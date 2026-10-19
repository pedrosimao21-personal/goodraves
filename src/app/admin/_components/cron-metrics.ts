import type { CronJobId, CronRunRecord, CronSummary } from '@/db/actions/cron-runs-core'

/** One column in a job's run-history table, read from the stored route summary. */
export type MetricColumn = { label: string; title: string; read: (summary: CronSummary) => string }

const MISSING = '–'

function readNumber(summary: CronSummary, step: string, field: string): number | null {
  const value = (summary[step] as Record<string, unknown> | undefined)?.[field]
  return typeof value === 'number' ? value : null
}

function stat(step: string, field: string) {
  return (summary: CronSummary) => String(readNumber(summary, step, field) ?? MISSING)
}

/** Sum of `field` across `steps`, e.g. budget-skipped work in two steps. */
function sumOf(steps: string[], field: string) {
  return (summary: CronSummary) => {
    const values = steps.map(step => readNumber(summary, step, field))
    if (values.every(value => value === null)) return MISSING
    return String(values.reduce<number>((total, value) => total + (value ?? 0), 0))
  }
}

function ratio(step: string, doneField: string, ofField: string) {
  return (summary: CronSummary) => {
    const done = readNumber(summary, step, doneField)
    const of = readNumber(summary, step, ofField)
    return done === null || of === null ? MISSING : `${done}/${of}`
  }
}

export const METRIC_COLUMNS: Record<CronJobId, MetricColumn[]> = {
  'import-pf-agenda': [
    { label: 'New', title: 'Events imported from the Partyflock agenda', read: stat('import', 'imported') },
    { label: 'Found', title: 'Unique events in the agenda window', read: stat('import', 'found') },
    { label: 'Known', title: 'Already in the database, skipped', read: stat('import', 'alreadyPresent') },
    { label: 'Failed', title: 'Agenda events that failed to import', read: stat('import', 'failed') },
    { label: 'Not reached', title: 'Not attempted: time budget ran out (resumes next run)', read: sumOf(['refresh', 'import'], 'skipped') },
    { label: 'Refreshed', title: 'Festivals re-fetched at their 7-/2-day checkpoint / due', read: ratio('refresh', 'refreshed', 'due') },
  ],
  'daily-maintenance': [
    { label: 'Merged', title: 'Duplicate festivals auto-merged', read: stat('dedupe', 'merged') },
    { label: 'To review', title: 'Uncertain duplicate pairs queued for /admin/duplicates', read: stat('dedupe', 'reviewQueued') },
    { label: 'TT updated', title: 'Timetables re-synced with changes', read: stat('timetables', 'updated') },
    { label: 'TT linked', title: 'Festivals newly linked to a Partyflock timetable', read: stat('autoLink', 'linked') },
    { label: 'Link review', title: 'Partyflock timetable matches too uncertain to link', read: stat('autoLink', 'needsReview') },
    { label: 'Not reached', title: 'Not attempted: time budget ran out (resumes next run)', read: sumOf(['timetables', 'autoLink'], 'skipped') },
  ],
}

/** Every error a run reported: the thrown error, plus each step's errors prefixed by step name. */
export function listRunErrors(run: CronRunRecord): string[] {
  const stepErrors = Object.entries(run.summary ?? {}).flatMap(([step, result]) =>
    (result.errors ?? []).map(error => `${step}: ${error}`),
  )
  return run.error ? [run.error, ...stepErrors] : stepErrors
}

/** The auto-link "needs review" count from the newest finished maintenance run. */
export function readLatestLinkReviewCount(runs: CronRunRecord[]): number | null {
  const latest = runs.find(run => run.summary)
  return latest?.summary ? readNumber(latest.summary, 'autoLink', 'needsReview') : null
}
