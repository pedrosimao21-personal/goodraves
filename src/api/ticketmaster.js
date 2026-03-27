/**
 * Ticketmaster Discovery API client
 * Docs: https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/
 *
 * Get a FREE key at: https://developer.ticketmaster.com/
 * Then add it to .env: VITE_TICKETMASTER_KEY=your_key
 */

const BASE_URL = 'https://app.ticketmaster.com/discovery/v2'
const API_KEY = import.meta.env.VITE_TICKETMASTER_KEY

/** Search for music festivals / events */
export async function searchFestivals({ keyword = '', page = 0, size = 20, countryCode = '' } = {}) {
  if (!API_KEY || API_KEY === 'your_ticketmaster_api_key_here') {
    throw new Error('NO_API_KEY')
  }

  const params = new URLSearchParams({
    apikey: API_KEY,
    keyword,
    classificationName: 'music',
    type: 'event',
    page,
    size,
    sort: 'date,asc',
  })

  if (countryCode) params.set('countryCode', countryCode)

  const res = await fetch(`${BASE_URL}/events.json?${params}`)
  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Ticketmaster error ${res.status}: ${errText}`)
  }

  const data = await res.json()
  const events = data?._embedded?.events ?? []
  const page_info = data?.page ?? { totalElements: 0, totalPages: 0 }

  return {
    events: events.map(normalizeEvent),
    page: page_info,
  }
}

/** Get a single event by ID */
export async function getEventById(id) {
  if (!API_KEY || API_KEY === 'your_ticketmaster_api_key_here') {
    throw new Error('NO_API_KEY')
  }

  const res = await fetch(`${BASE_URL}/events/${id}.json?apikey=${API_KEY}`)
  if (!res.ok) throw new Error(`Event not found (${res.status})`)
  const data = await res.json()
  return normalizeEvent(data)
}

/** Search for a specific artist/attraction */
export async function searchAttraction(name) {
  if (!API_KEY || API_KEY === 'your_ticketmaster_api_key_here') return []

  const params = new URLSearchParams({ apikey: API_KEY, keyword: name, size: 1, classificationName: 'music' })
  const res = await fetch(`${BASE_URL}/attractions.json?${params}`)
  if (!res.ok) return []
  const data = await res.json()
  return data?._embedded?.attractions ?? []
}

/** Normalize a raw TM event to a cleaner shape */
function normalizeEvent(e) {
  const venue = e._embedded?.venues?.[0] ?? {}
  const attraction = e._embedded?.attractions ?? []
  const image = e.images?.find(i => i.ratio === '16_9' && i.width > 1000)
    ?? e.images?.find(i => i.ratio === '16_9')
    ?? e.images?.[0]
    ?? null

  return {
    id: e.id,
    name: e.name,
    date: e.dates?.start?.localDate ?? null,
    time: e.dates?.start?.localTime ?? null,
    venue: {
      name: venue.name ?? 'Unknown Venue',
      city: venue.city?.name ?? '',
      country: venue.country?.name ?? '',
      countryCode: venue.country?.countryCode ?? '',
      address: venue.address?.line1 ?? '',
    },
    image: image?.url ?? null,
    url: e.url ?? null,
    priceRange: e.priceRanges?.[0] ?? null,
    genre: e.classifications?.[0]?.genre?.name ?? null,
    subGenre: e.classifications?.[0]?.subGenre?.name ?? null,
    attractions: attraction.map(a => ({
      id: a.id,
      name: a.name,
      image: a.images?.find(i => i.ratio === '16_9')?.url ?? a.images?.[0]?.url ?? null,
      url: a.url ?? null,
    })),
    status: e.dates?.status?.code ?? 'onsale',
    source: 'ticketmaster',
  }
}
