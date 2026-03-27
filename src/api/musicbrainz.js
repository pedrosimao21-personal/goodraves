/**
 * MusicBrainz API client
 * Docs: https://musicbrainz.org/doc/MusicBrainz_API
 *
 * Completely FREE and open — no key needed.
 * Rate limit: 1 req/sec
 */

const BASE_URL = 'https://musicbrainz.org/ws/2'
const USER_AGENT = 'FestivalTracker/1.0 (festival-tracker@example.com)'

async function mbFetch(path, params = {}) {
  const url = new URL(`${BASE_URL}${path}`)
  url.searchParams.set('fmt', 'json')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))

  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
  })
  if (!res.ok) throw new Error(`MusicBrainz error ${res.status}`)
  return res.json()
}

/** Search for artists by name */
export async function searchArtists(name, limit = 5) {
  try {
    const data = await mbFetch('/artist', { query: `artist:${name}`, limit })
    return (data.artists ?? []).map(a => ({
      id: a.id,
      name: a.name,
      type: a.type ?? null,
      country: a.country ?? null,
      tags: (a.tags ?? []).slice(0, 5).map(t => t.name),
      disambiguation: a.disambiguation ?? null,
    }))
  } catch {
    return []
  }
}

/** Search for events (festivals) by name */
export async function searchEvents(name, limit = 10) {
  try {
    const data = await mbFetch('/event', { query: name, limit })
    return (data.events ?? []).map(e => ({
      id: e.id,
      name: e.name,
      type: e.type ?? null,
      time: e.time ?? null,
      lifeSpan: e['life-span'] ?? null,
    }))
  } catch {
    return []
  }
}

/** Get artist details by MBID */
export async function getArtistById(mbid) {
  try {
    const data = await mbFetch(`/artist/${mbid}`, { inc: 'tags+url-rels' })
    return {
      id: data.id,
      name: data.name,
      type: data.type ?? null,
      country: data.country ?? null,
      tags: (data.tags ?? []).slice(0, 6).map(t => t.name),
      urls: (data.relations ?? [])
        .filter(r => r.type && r.url)
        .map(r => ({ type: r.type, url: r.url.resource })),
    }
  } catch {
    return null
  }
}
