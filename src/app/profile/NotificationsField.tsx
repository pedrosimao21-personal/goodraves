'use client'

import { useEffect, useState } from 'react'
import { getNotificationOverview, setMyNotification, type NotificationOverview } from '@/db/actions/notifications'
import { NEXT_RAVE_REMINDER_DAYS_AHEAD } from '@/lib/constants'
import { NOTIFICATION_LABELS, type NotificationKind } from '@/lib/notification-kinds'
import { Field } from './ProfileFields'
import styles from './Profile.module.css'

const OPTIONS: { kind: NotificationKind; description: string }[] = [
  { kind: 'next_rave_reminder', description: `${NEXT_RAVE_REMINDER_DAYS_AHEAD} days before a festival on your list.` },
  { kind: 'monthly_recap', description: 'In the first days of the month: the festivals you went to last month.' },
]

/** Opt-in emails, all off until switched on. Each saves straight away; switching on needs a confirmed email. */
export function NotificationsField() {
  const [overview, setOverview] = useState<NotificationOverview | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getNotificationOverview().then(setOverview).catch(() => setError('Could not load your notifications.'))
  }, [])

  async function toggle(kind: NotificationKind, isEnabled: boolean) {
    if (!overview) return
    const before = overview
    setError(null)
    setOverview({ ...before, settings: { ...before.settings, [kind]: isEnabled } })
    try {
      await setMyNotification(kind, isEnabled)
    } catch {
      setOverview(before)
      setError('Could not save. Try again.')
    }
  }

  return (
    <Field title="Notifications" hint="Emails you choose to get. Every one has an unsubscribe link.">
      {overview && !overview.isEmailConfirmed && (
        <p className={`form-hint ${styles.accountNote}`}>Confirm your email above to turn these on.</p>
      )}
      {overview && OPTIONS.map(({ kind, description }) => {
        const isOn = overview.settings[kind]
        return (
          <label key={kind} className={styles.toggleRow}>
            <input
              type="checkbox"
              checked={isOn}
              disabled={!overview.isEmailConfirmed && !isOn}
              onChange={event => toggle(kind, event.target.checked)}
            />
            <span>
              <span className={styles.toggleTitle}>{NOTIFICATION_LABELS[kind]}</span>
              <span className={styles.toggleHint}>{description}</span>
            </span>
          </label>
        )
      })}
      {error && <p className="form-error" role="alert">{error}</p>}
    </Field>
  )
}
