import { notFound } from 'next/navigation'
import { getOptionalUserId, isUserAdmin } from '@/db/actions/festival-helpers'
import { getAdminDashboardData } from '@/db/actions/admin-dashboard-core'
import AttentionCards from './_components/AttentionCards'
import CronJobSection from './_components/CronJobSection'
import FestivalStats from './_components/FestivalStats'
import { readLatestLinkReviewCount } from './_components/cron-metrics'
import { countFailedRuns } from './_components/cron-display'
import styles from './_components/Admin.module.css'

export const dynamic = 'force-dynamic'

const FAILED_RUNS_DAYS = 7

/**
 * Admin overview: work waiting on an admin, the health and history of the
 * Vercel Cron jobs (recorded in cron_runs by recordCronRun), and festival
 * counts. Non-admins get a plain 404, like /admin/duplicates. Board: Admin.
 */
export default async function AdminPage() {
  const userId = await getOptionalUserId()
  if (!userId || !(await isUserAdmin(userId))) notFound()

  const data = await getAdminDashboardData()
  const maintenance = data.jobs.find(job => job.id === 'daily-maintenance')
  const failedRuns = countFailedRuns(data.jobs.flatMap(job => job.runs), data.now, FAILED_RUNS_DAYS)

  return (
    <div className="page">
      <div className="container">
        <p className={`mono ${styles.eyebrow}`}>Admins only</p>
        <h1 className={`display ${styles.title}`}>Admin</h1>

        <section className={styles.section}>
          <h2 className={`mono ${styles.sectionLabel}`}>Needs attention</h2>
          <AttentionCards
            pendingDuplicates={data.pendingDuplicates}
            linkReviewCount={readLatestLinkReviewCount(maintenance?.runs ?? [])}
            failedRuns={failedRuns}
            failedRunsDays={FAILED_RUNS_DAYS}
          />
        </section>

        <section className={styles.section}>
          <h2 className={`display ${styles.sectionTitle}`}>Cron jobs</h2>
          {data.jobs.map(job => <CronJobSection key={job.id} job={job} now={data.now} />)}
        </section>

        <FestivalStats sources={data.sources} mergedRecently={data.mergedRecently} recentDays={data.recentDays} />
      </div>
    </div>
  )
}
