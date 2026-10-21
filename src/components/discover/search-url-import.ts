import {
  fetchRAEvent,
  fetchFFEvent,
  fetchPFEvent,
  resolvePartyflockSlug,
} from '@/db/actions/festivals'

/** Extract an RA event ID from a ra.co URL, or return null */
function extractRAEventId(input: string): string | null {
  const match = input.match(/ra\.co\/events\/(\d+)/)
  return match ? match[1] : null
}

/** Extract a FestivalFans slug from a festivalfans.nl URL, or return null */
function extractFFSlug(input: string): string | null {
  const match = input.match(/festivalfans\.nl\/event\/([a-z0-9-]+)/i)
  return match ? match[1] : null
}

/** Extract a Partyflock party ID from a partyflock.nl URL, or return null */
function extractPFPartyId(input: string): string | null {
  const match = input.match(/partyflock\.nl\/party\/(\d+)/)
  return match ? match[1] : null
}

/** Extract a Partyflock event slug from a /event/ URL, or return null */
function extractPFEventSlug(input: string): string | null {
  const match = input.match(/partyflock\.nl\/event\/([a-z0-9-]+)/i)
  return match ? match[1] : null
}

/** Name of the site a pasted event link points at, or null for a plain query. */
export function detectUrlSource(input: string): string | null {
  if (extractRAEventId(input)) return 'Resident Advisor'
  if (extractFFSlug(input)) return 'FestivalFans'
  if (extractPFPartyId(input) || extractPFEventSlug(input)) return 'Partyflock'
  return null
}

export type UrlImportResult = { festivalId: string } | { error: string }

function toImportResult(festivalId: string | null, siteName: string): UrlImportResult {
  if (festivalId) return { festivalId }
  return { error: `Could not fetch event from ${siteName}. The event may not exist or the site may be unavailable.` }
}

async function resolvePFPartyId(input: string): Promise<string | null> {
  const partyId = extractPFPartyId(input)
  if (partyId) return partyId
  const slug = extractPFEventSlug(input)
  return slug ? resolvePartyflockSlug(slug) : null
}

/**
 * Imports the event behind a pasted RA, FestivalFans or Partyflock link.
 * Returns null when the input is not such a link (or a Partyflock slug that
 * doesn't resolve), so the caller runs a normal text search instead.
 */
export async function importFromUrl(input: string): Promise<UrlImportResult | null> {
  const raEventId = extractRAEventId(input)
  if (raEventId) {
    return toImportResult(await fetchRAEvent(raEventId, { force: true }), 'Resident Advisor')
  }

  const ffSlug = extractFFSlug(input)
  if (ffSlug) {
    return toImportResult(await fetchFFEvent(ffSlug, { force: true }), 'FestivalFans.nl')
  }

  const pfPartyId = await resolvePFPartyId(input)
  if (pfPartyId) {
    return toImportResult(await fetchPFEvent(pfPartyId, { force: true }), 'Partyflock.nl')
  }

  return null
}
