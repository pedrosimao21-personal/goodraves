import {
  fetchFFEventImageUrl,
  fetchRAEventImageUrl,
  fetchPFEventImageUrl,
} from '@/db/actions/festivals'

/** One festival card on Discover, merged from our DB and the live sources. */
export type SearchResult = Record<string, any>

export type SearchSource = 'db' | 'partyflock' | 'ra' | 'festivalfans'

export const SOURCE_NAMES: Record<SearchSource, string> = {
  db: 'Goodraves',
  partyflock: 'Partyflock',
  ra: 'Resident Advisor',
  festivalfans: 'FestivalFans',
}

/**
 * ID prefixes whose missing image the search resolves itself, in the
 * enrichment pass at the end of the search. Cards for these skip their own
 * image lookup, so an imageless result costs one request instead of two.
 * Other results (custom-, external DB rows) rely on the card's own lookup.
 */
const IMAGE_LOOKUPS: Record<string, (id: string) => Promise<string | null>> = {
  'ff-': fetchFFEventImageUrl,
  'ra-': fetchRAEventImageUrl,
  'pf-': fetchPFEventImageUrl,
}

export function hasSourceImageLookup(eventId: string): boolean {
  return Object.keys(IMAGE_LOOKUPS).some((prefix) => eventId.startsWith(prefix))
}

/** Dedup key across sources: the same festival name on the same date. */
export function buildResultKey(result: SearchResult): string {
  return `${result.name?.toLowerCase()}::${result.date ?? ''}`
}

export function sortByDateDesc(list: SearchResult[]): SearchResult[] {
  return [...list].sort((a, b) => {
    if (!a.date) return 1
    if (!b.date) return -1
    return b.date.localeCompare(a.date)
  })
}

/** Source ids of DB rows imported from `source`, so a live hit for them is skipped. */
export function collectSourceIds(dbRows: any[], source: string): Set<string> {
  return new Set(
    dbRows
      .filter((row) => row.source === source && row.sourceId)
      .map((row) => String(row.sourceId)),
  )
}

function toVenue(venue?: string | null, location?: string | null) {
  return venue ? { name: venue, city: location ?? '' } : undefined
}

export function mapDbResult(row: any): SearchResult {
  return {
    id: row.id,
    name: row.name,
    date: row.date,
    endDate: row.endDate,
    venue: toVenue(row.venue, row.location),
    location: row.location,
    countryCode: row.countryCode,
    countryName: row.countryName,
    lineup: [],
    source: row.source ?? 'ra',
    image: row.imageUrl,
    genres: row.genres ?? [],
  }
}

export function mapPfResult(pf: any): SearchResult {
  return {
    id: `pf-${pf.pfId}`,
    name: pf.name,
    date: pf.date,
    venue: toVenue(pf.venue, pf.location),
    location: pf.location,
    // Partyflock search results carry a city only, no country: the country
    // filter falls back to the location-string derivation in filter-utils.ts.
    lineup: [],
    source: 'partyflock',
    image: pf.imageUrl,
    _fromPF: true,
  }
}

export function mapRaResult(ra: any): SearchResult {
  return {
    id: `ra-${ra.raId}`,
    name: ra.name,
    date: ra.date,
    endDate: ra.endDate,
    venue: toVenue(ra.venue, ra.location),
    location: ra.location,
    countryCode: ra.countryCode,
    countryName: ra.country,
    lineup: [],
    source: 'ra',
    image: ra.imageUrl,
    _fromRA: true,
  }
}

export function mapFfResult(ff: any): SearchResult {
  return {
    id: `ff-${ff.ffSlug}`,
    name: ff.name,
    date: ff.date,
    venue: toVenue(ff.venue, ff.location),
    location: ff.location,
    countryCode: ff.countryCode,
    countryName: ff.countryName,
    lineup: [],
    source: 'festivalfans',
    image: ff.imageUrl,
    _fromFF: true,
  }
}

/** Adds the candidates whose name + date isn't on screen yet. */
export function appendUnique(results: SearchResult[], keys: Set<string>, candidates: SearchResult[]): void {
  for (const candidate of candidates) {
    const key = buildResultKey(candidate)
    if (keys.has(key)) continue
    keys.add(key)
    results.push(candidate)
  }
}

function lookupImage(result: SearchResult): Promise<[string, string] | null> | null {
  const prefix = Object.keys(IMAGE_LOOKUPS).find((p) => result.id?.startsWith(p))
  if (!prefix || result.image) return null
  return IMAGE_LOOKUPS[prefix](result.id.slice(prefix.length))
    .then((imageUrl): [string, string] | null => (imageUrl ? [result.id, imageUrl] : null))
}

/** Resolves images for live-source results that came back without one, keyed by result id. */
export async function fetchMissingImages(results: SearchResult[]): Promise<Map<string, string>> {
  const lookups = results.map(lookupImage).filter((p) => p !== null)
  const settled = await Promise.allSettled(lookups)
  const images = new Map<string, string>()
  for (const outcome of settled) {
    if (outcome.status === 'fulfilled' && outcome.value) images.set(...outcome.value)
  }
  return images
}
