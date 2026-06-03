/**
 * Geocoding utility using the OpenStreetMap Nominatim API.
 * No API key required. Returns [latitude, longitude] or null.
 *
 * Rate limit: max 1 request/second per Nominatim policy.
 * We only call this during festival imports (not on every page load),
 * so rate limiting is not a concern in practice.
 */

const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org/search'
const NOMINATIM_USER_AGENT = 'Goodraves/1.0 (festival tracker)'

export type Coords = {
  latitude: number
  longitude: number
}

/**
 * Geocode a city or location string to coordinates.
 * Returns null on failure or when the query is empty.
 */
export async function geocodeLocation(query: string): Promise<Coords | null> {
  if (!query?.trim()) return null

  try {
    const url = new URL(NOMINATIM_BASE_URL)
    url.searchParams.set('q', query.trim())
    url.searchParams.set('format', 'json')
    url.searchParams.set('limit', '1')
    url.searchParams.set('addressdetails', '0')

    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': NOMINATIM_USER_AGENT },
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    })

    if (!res.ok) return null

    const results: Array<{ lat: string; lon: string }> = await res.json()
    if (!results.length) return null

    const lat = parseFloat(results[0].lat)
    const lng = parseFloat(results[0].lon)
    if (isNaN(lat) || isNaN(lng)) return null

    return { latitude: lat, longitude: lng }
  } catch {
    return null
  }
}
