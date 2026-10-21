import Link from 'next/link'
import { ArrowRightIcon } from '@/components/icons'
import styles from './Admin.module.css'

type Props = {
  pendingDuplicates: number
  /** From the newest maintenance run; null when there is none yet. */
  linkReviewCount: number | null
  /** Error or never-finished runs across all cron jobs in the window below. */
  failedRuns: number
  failedRunsDays: number
}

/** Work waiting on an admin. Only the duplicates queue has a page to act on. Board: Admin. */
export default function AttentionCards({ pendingDuplicates, linkReviewCount, failedRuns, failedRunsDays }: Props) {
  return (
    <div className={styles.attention}>
      <Link href="/admin/duplicates" className={styles.attentionItem}>
        <span className={`display ${styles.attentionValue} ${pendingDuplicates > 0 ? styles.attentionValueWarn : ''}`}>{pendingDuplicates}</span>
        <span className={`mono ${styles.attentionLabel}`}>Possible duplicates · review<ArrowRightIcon size={14} strokeWidth={2} /></span>
      </Link>
      <div className={styles.attentionItem}>
        <span className={`display ${styles.attentionValue}`}>{linkReviewCount ?? '–'}</span>
        <span className={`mono ${styles.attentionLabel}`}>Uncertain timetable links · last maintenance run</span>
      </div>
      <div className={styles.attentionItem}>
        <span className={`display ${styles.attentionValue} ${failedRuns > 0 ? styles.attentionValueErr : ''}`}>{failedRuns}</span>
        <span className={`mono ${styles.attentionLabel}`}>Failed cron runs · last {failedRunsDays} days</span>
      </div>
    </div>
  )
}
