/** Canonical public origin, no trailing slash. Used for absolute links (sitemap, .ics, share metadata). */
export const SITE_URL = 'https://goodraves.com'

/** The people who run Goodraves: the joint data controllers named on /privacy, listed on /contact. */
export const TEAM = [
  { name: 'Pedro Jorge', email: 'pedro.simao10@hotmail.com' },
  { name: 'Maarten van den Hoven', email: 'info@maartenvandenhoven.com' },
] as const

/** The single address quoted where one is needed (privacy requests, takedowns, the profile's data-copy hint). */
export const CONTACT_EMAIL = TEAM[0].email

/** Date the privacy policy and terms were last changed. Update when either page changes. */
export const LEGAL_LAST_UPDATED = '2 November 2026'
