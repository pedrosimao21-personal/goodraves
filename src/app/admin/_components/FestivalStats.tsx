import type { SourceCount } from '@/db/actions/admin-dashboard-core'
import styles from './Admin.module.css'

type Props = { sources: SourceCount[]; mergedRecently: number; recentDays: number }

/** Festival counts straight from our own tables, independent of cron history. Board: Admin. */
export default function FestivalStats({ sources, mergedRecently, recentDays }: Props) {
  const total = sources.reduce((sum, row) => sum + row.total, 0)
  const recent = sources.reduce((sum, row) => sum + row.recent, 0)
  return (
    <section className={`${styles.section} ${styles.festivals}`}>
      <h2 className={`display ${styles.sectionTitle}`}>Festivals</h2>
      <p className={styles.muted}>
        {total} festivals in total. In the last {recentDays} days: {recent} added, {mergedRecently} merged away as duplicates.
      </p>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Source</th>
              <th>Total</th>
              <th>Added · {recentDays} days</th>
            </tr>
          </thead>
          <tbody>
            {sources.map(row => (
              <tr key={row.source}>
                <td>{row.source}</td>
                <td className={styles.numeric}>{row.total}</td>
                <td className={styles.numeric}>{row.recent}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
