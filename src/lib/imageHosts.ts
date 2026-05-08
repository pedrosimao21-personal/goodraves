/**
 * Allowed image hostnames, kept in sync with next.config.ts `images.remotePatterns`.
 * Patterns starting with "*." match any subdomain.
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
