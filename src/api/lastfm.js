/**
 * Last.fm API client
 * Docs: https://www.last.fm/api
 *
 * Get a FREE key at: https://www.last.fm/api/account/create
 * Then add it to .env: VITE_LASTFM_KEY=your_key
 */

const BASE_URL = 'https://ws.audioscrobbler.com/2.0/'
const API_KEY = import.meta.env.VITE_LASTFM_KEY

async function call(params) {
  if (!API_KEY || API_KEY === 'your_lastfm_api_key_here') {
    throw new Error('NO_LASTFM_KEY')
  }

  const url = new URL(BASE_URL)
  Object.entries({ ...params, api_key: API_KEY, format: 'json' }).forEach(([k, v]) =>
    url.searchParams.set(k, v)
  )

  const res = await fetch(url)
  if (!res.ok) throw new Error(`Last.fm error ${res.status}`)
  const data = await res.json()
  if (data.error) throw new Error(`Last.fm: ${data.message}`)
  return data
}

/** Get artist info (bio, image, tags) */
export async function getArtistInfo(name) {
  const data = await call({ method: 'artist.getinfo', artist: name, autocorrect: 1 })
  const artist = data.artist

  const images = artist.image ?? []
  const imageUrl = images.find(i => i.size === 'extralarge')?.['#text']
    ?? images.find(i => i.size === 'large')?.['#text']
    ?? null

  const bio = artist.bio?.content ?? artist.bio?.summary ?? ''
  let cleanBio = bio.replace(/<a href="[^"]*">Read more on Last\.fm<\/a>/gi, '').trim()
  cleanBio = cleanBio.replace(/User-contributed text is available under the Creative Commons By-SA License; additional terms may apply\./gi, '').trim()

  // Handle multi-artist bios (e.g. 1. DJ name 2. Band name)
  if (cleanBio.includes('1. ') && cleanBio.includes('2. ')) {
    const parts = cleanBio.split(/\b\d+\. /g).filter(p => p.trim().length > 10)
    if (parts.length > 1) {
      // Prioritize the part that mentions electronic music keywords
      const electronicKeywords = ['dj', 'techno', 'electronic', 'house', 'rave', 'producer', 'trance', 'berlin', 'club']
      const bestPart = parts.find(p => electronicKeywords.some(k => p.toLowerCase().includes(k)))
      if (bestPart) cleanBio = bestPart.trim()
    }
  }

  return {
    name: artist.name,
    mbid: artist.mbid ?? null,
    url: artist.url ?? null,
    image: imageUrl && imageUrl !== '' ? imageUrl : null,
    listeners: artist.stats?.listeners ?? null,
    playcount: artist.stats?.playcount ?? null,
    tags: normalizeGenres((artist.tags?.tag ?? []).slice(0, 5).map(t => t.name)),
    bio: cleanBio,
    similar: (artist.similar?.artist ?? []).slice(0, 5).map(a => ({
      name: a.name,
      url: a.url,
      image: a.image?.find(i => i.size === 'medium')?.['#text'] ?? null,
    })),
  }
}

/** Specific genre normalization rules as requested by user */
function normalizeGenres(genres) {
  if (!genres) return []
  const BLACKLIST = new Set(['swedish', 'dancehall', 'rave'])
  const MAPPINGS = {
    'electronica': 'electronic',
    'acid techno': 'acid',
    'minimal techno': 'minimal',
  }

  return genres
    .map(g => g.toLowerCase().trim())
    .filter(g => !BLACKLIST.has(g))
    .map(g => MAPPINGS[g] || g)
    .filter((v, i, a) => a.indexOf(v) === i) // Unique
}

/** Get artist's top tracks */
export async function getArtistTopTracks(name, limit = 8) {
  const data = await call({ method: 'artist.gettoptracks', artist: name, autocorrect: 1, limit })
  const tracks = data.toptracks?.track ?? []
  return tracks
    .map(t => ({
      name: t.name,
      playcount: parseInt(t.playcount, 10) || 0,
      url: t.url ?? null,
      listeners: parseInt(t.listeners, 10) || 0,
    }))
    .sort((a, b) => b.playcount - a.playcount)
}

/** Search for an artist */
export async function searchArtist(name, limit = 5) {
  const data = await call({ method: 'artist.search', artist: name, limit })
  return (data.results?.artistmatches?.artist ?? []).map(a => ({
    name: a.name,
    mbid: a.mbid ?? null,
    image: a.image?.find(i => i.size === 'large')?.['#text'] ?? null,
  }))
}
