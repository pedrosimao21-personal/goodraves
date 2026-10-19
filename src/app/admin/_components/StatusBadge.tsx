import type { RunDisplayStatus } from './cron-display'

const STATUS_STYLES: Record<RunDisplayStatus, { label: string; color: string }> = {
  ok: { label: 'OK', color: 'var(--success-text)' },
  partial: { label: 'Partial', color: 'var(--warning-text)' },
  error: { label: 'Error', color: 'var(--error-text)' },
  killed: { label: 'Never finished', color: 'var(--error-text)' },
  running: { label: 'Running', color: 'var(--state-going)' },
}

export default function StatusBadge({ status }: { status: RunDisplayStatus }) {
  const { label, color } = STATUS_STYLES[status]
  return (
    <span style={{
      color,
      border: `1px solid ${color}`,
      borderRadius: 999,
      padding: '2px 10px',
      fontSize: '0.75rem',
      fontWeight: 600,
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  )
}
