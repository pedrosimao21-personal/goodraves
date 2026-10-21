import type { RunDisplayStatus } from './cron-display'
import styles from './Admin.module.css'

const STATUS: Record<RunDisplayStatus, { label: string; className: string }> = {
  ok: { label: 'OK', className: styles.statusOk },
  partial: { label: 'Partial', className: styles.statusPartial },
  error: { label: 'Error', className: styles.statusError },
  killed: { label: 'Never finished', className: styles.statusError },
  running: { label: 'Running', className: styles.statusRunning },
}

export default function StatusBadge({ status }: { status: RunDisplayStatus }) {
  const { label, className } = STATUS[status]
  return <span className={`${styles.status} ${className}`}>{label}</span>
}
