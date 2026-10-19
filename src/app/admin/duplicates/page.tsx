import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getOptionalUserId, isUserAdmin } from '@/db/actions/festival-helpers'
import { listPendingDuplicates } from '@/db/actions/festival-duplicates-core'
import DuplicatesReview from './DuplicatesReview'

export const dynamic = 'force-dynamic'

/**
 * Admin review queue for the daily dedupe (festival-dedupe-core.ts): pairs
 * that look like the same event but weren't certain enough to auto-merge.
 * Non-admins get a plain 404 — the page's existence isn't advertised.
 */
export default async function AdminDuplicatesPage() {
  const userId = await getOptionalUserId()
  if (!userId || !(await isUserAdmin(userId))) notFound()

  const candidates = await listPendingDuplicates()

  return (
    <div className="page fade-in">
      <div className="container" style={{ paddingTop: 32 }}>
        <Link href="/admin" style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>← Admin</Link>
        <h1 className="section-title" style={{ fontSize: '2rem', marginBottom: 8 }}>Possible duplicates</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: 32 }}>
          The daily check found these pairs but wasn&apos;t sure enough to merge them. Merging keeps the chosen
          festival and moves the other one&apos;s lineup, timetable and user data onto it.
        </p>
        <DuplicatesReview initialCandidates={candidates} />
      </div>
    </div>
  )
}
