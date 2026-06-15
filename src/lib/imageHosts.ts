/**
 * Allowed image hostnames. MUST be kept in sync with the `images.remotePatterns`
 * list AND the CSP `img-src` directive in next.config.ts — when you add a host in
 * one place, add it in all three. Patterns starting with "*." match any subdomain.
 */
const ALLOWED_PATTERNS: Array<{ wildcard: boolean; host: string }> = [
  { wildcard: true,  host: 'scdn.co' },
  { wildcard: false, host: 'i.scdn.co' },
  { wildcard: false, host: 'images.universe.com' },
  { wildcard: true,  host: 'ra.co' },
  { wildcard: false, host: 'ra.co' },
  { wildcard: false, host: 'upload.wikimedia.org' },
  { wildcard: false, host: 'i.imgur.com' },
  { wildcard: false, host: 'assets.awakenings.com' },
  { wildcard: false, host: 'lastfm.freetls.fastly.net' },
  { wildcard: false, host: 'festivalfans.nl' },
  { wildcard: false, host: 'partyflock.nl' },
  { wildcard: false, host: 'photo.partyflock.nl' },
  { wildcard: false, host: 'static.partyflock.nl' },
]

export function isAllowedImageHost(url: string): boolean {
  if (!url.trim()) return true // empty is fine — no image
  try {
    const { hostname } = new URL(url)
    return ALLOWED_PATTERNS.some(({ wildcard, host }) =>
      wildcard ? (hostname === host || hostname.endsWith('.' + host)) : hostname === host
    )
  } catch {
    return false // not a valid URL
  }
}
