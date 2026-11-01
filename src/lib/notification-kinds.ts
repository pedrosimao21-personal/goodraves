/** The email notifications a user can switch on. Safe to import in client code. */
export const NOTIFICATION_KINDS = ["next_rave_reminder", "monthly_recap"] as const;

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export function isNotificationKind(value: unknown): value is NotificationKind {
  return NOTIFICATION_KINDS.some((kind) => kind === value);
}

/** What the unsubscribe page and the profile call each one. */
export const NOTIFICATION_LABELS: Record<NotificationKind, string> = {
  next_rave_reminder: "Reminder before your next festival",
  monthly_recap: "Monthly recap",
};
