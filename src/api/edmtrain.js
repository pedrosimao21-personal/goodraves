/**
 * EDMTrain API client
 * Docs: https://edmtrain.com/api-documentation
 * Terms: https://edmtrain.com/api-terms-of-use
 *
 * Key assigned to this project — must link back to edmtrain.com per TOS.
 */

const BASE_URL = 'https://edmtrain.com/api'
const API_KEY = import.meta.env.VITE_EDMTRAIN_KEY

/** Search for events by name (and optional filters) */
export async function searchEvents({
  keyword = '',
  festivalOnly = false,
  startDate = '',
  endDate = '',
  locationIds = '',
  includeOtherGenres = false,
} = {}) {
  if (!API_KEY || API_KEY === 'your_edmtrain_api_key_here') {
    throw new Error('NO_EDMTRAIN_KEY')
  }

  const params = new URLSearchParams({ client: API_KEY })

  if (keyword.trim()) params.set('eventName', keyword.trim())
  if (festivalOnly) params.set('festivalInd', 'true')
  if (startDate) params.set('startDate', startDate)
  if (endDate) params.set('endDate', endDate)
  if (locationIds) params.set('locationIds', locationIds)
  if (includeOtherGenres) params.set('includeOtherGenreInd', 'true')

  const res = await fetch(`${BASE_URL}/events?${params}`)
  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`EDMTrain error ${res.status}: ${errText}`)
  }

  const json = await res.json()
  const events = json.data ?? []

  // Client-side filter by keyword if needed (EDMTrain eventName is exact match,
  // but we also want to match artist names in search)
  let filtered = events
  if (keyword.trim()) {
    const q = keyword.trim().toLowerCase()
    filtered = events.filter(e => {
      if (e.name && e.name.toLowerCase().includes(q)) return true
      if (e.artistList?.some(a => a.name.toLowerCase().includes(q))) return true
      if (e.venue?.name?.toLowerCase().includes(q)) return true
      if (e.venue?.location?.toLowerCase().includes(q)) return true
      return false
    })
  }

  return {
    events: filtered.map(normalizeEdmtrainEvent),
    total: filtered.length,
  }
}

/** Search by location (state, optional city) */
export async function searchByLocation({ state = '', city = '' } = {}) {
  if (!API_KEY) throw new Error('NO_EDMTRAIN_KEY')

  // First get location IDs
  const locParams = new URLSearchParams({ client: API_KEY })
  if (state) locParams.set('state', state)
  if (city) locParams.set('city', city)

  const locRes = await fetch(`${BASE_URL}/locations?${locParams}`)
  if (!locRes.ok) throw new Error(`EDMTrain locations error ${locRes.status}`)
  const locJson = await locRes.json()
  const locationIds = (locJson.data ?? []).map(l => l.id).join(',')

  if (!locationIds) return { events: [], total: 0 }

  return searchEvents({ locationIds })
}

/** Get location IDs */
export async function getLocations({ state = '', city = '' } = {}) {
  if (!API_KEY) throw new Error('NO_EDMTRAIN_KEY')

  const params = new URLSearchParams({ client: API_KEY })
  if (state) params.set('state', state)
  if (city) params.set('city', city)

  const res = await fetch(`${BASE_URL}/locations?${params}`)
  if (!res.ok) throw new Error(`EDMTrain locations error ${res.status}`)
  const json = await res.json()
  return json.data ?? []
}

/** Normalize an EDMTrain event to match the Ticketmaster normalized shape */
function normalizeEdmtrainEvent(e) {
  const locationParts = e.venue?.location?.split(', ') ?? []
  const city = locationParts[0] ?? ''
  const stateOrCountry = locationParts.slice(1).join(', ')

  return {
    id: `edm_${e.id}`,
    name: e.name || (e.artistList?.[0]?.name ?? 'Unnamed Event'),
    date: e.date ?? null,
    time: e.startTime ?? null,
    venue: {
      name: e.venue?.name ?? 'Unknown Venue',
      city: city,
      country: e.venue?.country ?? stateOrCountry,
      countryCode: '',
      address: e.venue?.address ?? '',
      state: e.venue?.state ?? '',
      latitude: e.venue?.latitude ?? null,
      longitude: e.venue?.longitude ?? null,
    },
    image: null, // EDMTrain doesn't provide event images
    url: e.link ?? null,
    priceRange: null,
    genre: e.electronicGenreInd ? 'Electronic' : (e.otherGenreInd ? 'Other' : null),
    subGenre: e.festivalInd ? 'Festival' : null,
    attractions: (e.artistList ?? []).map(a => ({
      id: `edm_artist_${a.id}`,
      name: a.name,
      image: null, // EDMTrain doesn't provide artist images
      url: a.link ?? null,
    })),
    status: 'onsale',
    source: 'edmtrain',
    ages: e.ages ?? null,
    festivalInd: e.festivalInd ?? false,
    edmtrainLink: e.link ?? null, // Keep original link for TOS compliance
  }
}

export const HAS_EDMTRAIN_KEY = API_KEY && API_KEY !== 'your_edmtrain_api_key_here'
