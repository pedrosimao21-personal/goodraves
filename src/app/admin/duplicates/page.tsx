import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getOptionalUserId, isUserAdmin } from '@/db/actions/festival-helpers'
import { listPendingDuplicates } from '@/db/actions/festival-duplicates-core'
import { ArrowLeftIcon } from '@/components/icons'
import DuplicatesReview from './DuplicatesReview'
import styles from './Duplicates.module.css'

export const dynamic = 'force-dynamic'

/**
 * Admin review queue for the daily dedupe (festival-dedupe-core.ts): pairs
 * that look like the same event but weren't certain enough to auto-merge.
 * Non-admins get a plain 404 — the page's existence isn't advertised.
 * Board: AdminDuplicates.
 */
export default async function AdminDuplicatesPage() {
  const userId = await getOptionalUserId()
  if (!userId || !(await isUserAdmin(userId))) notFound()

  const candidates = await listPendingDuplicates()

  return (
    <div className="page">
      <div className="container">
        <Link href="/admin" className={`mono ${styles.back}`}><ArrowLeftIcon size={16} strokeWidth={2} />Admin</Link>
        <div className={styles.header}>
          <h1 className={`display ${styles.title}`}>Possible duplicates <span className={styles.count}>{candidates.length}</span></h1>
          <p className={styles.intro}>
            The daily dedupe wasn&apos;t sure enough to merge these. Merging moves lineups, timetables and attendance
            onto the one you keep; old links redirect. Dismissed pairs are never suggested again.
          </p>
        </div>
        <DuplicatesReview initialCandidates={candidates} />
      </div>
    </div>
  )
}
