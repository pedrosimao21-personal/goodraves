import { notFound } from 'next/navigation'
import { getOptionalUserId, isUserAdmin } from '@/db/actions/festival-helpers'
import { getAdminDashboardData } from '@/db/actions/admin-dashboard-core'
import AttentionCards from './_components/AttentionCards'
import CronJobSection from './_components/CronJobSection'
import FestivalStats from './_components/FestivalStats'
import { readLatestLinkReviewCount } from './_components/cron-metrics'

export const dynamic = 'force-dynamic'

const SECTION_TITLE_STYLE = { fontSize: '1.4rem', margin: '8px 0 16px' }

/**
 * Admin overview: work waiting on an admin, the health and history of the
 * Vercel Cron jobs (recorded in cron_runs by recordCronRun), and festival
 * counts. Non-admins get a plain 404, like /admin/duplicates.
 */
export default async function AdminPage() {
  const userId = await getOptionalUserId()
  if (!userId || !(await isUserAdmin(userId))) notFound()

  const data = await getAdminDashboardData()
  const maintenance = data.jobs.find(job => job.id === 'daily-maintenance')

  return (
    <div className="page fade-in">
      <div className="container" style={{ paddingTop: 32 }}>
        <h1 className="section-title" style={{ fontSize: '2rem', marginBottom: 24 }}>Admin</h1>

        <h2 style={SECTION_TITLE_STYLE}>Needs attention</h2>
        <AttentionCards
          pendingDuplicates={data.pendingDuplicates}
          linkReviewCount={readLatestLinkReviewCount(maintenance?.runs ?? [])}
        />

        <h2 style={SECTION_TITLE_STYLE}>Cron jobs</h2>
        {data.jobs.map(job => <CronJobSection key={job.id} job={job} now={data.now} />)}

        <h2 style={SECTION_TITLE_STYLE}>Festivals</h2>
        <FestivalStats sources={data.sources} mergedRecently={data.mergedRecently} recentDays={data.recentDays} />
      </div>
    </div>
  )
}
