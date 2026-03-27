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
  // Strip Last.fm "Read more" link
  const cleanBio = bio.replace(/<a href="[^"]*">Read more on Last.fm<\/a>/gi, '').trim()

  return {
    name: artist.name,
    mbid: artist.mbid ?? null,
    url: artist.url ?? null,
    image: imageUrl && imageUrl !== '' ? imageUrl : null,
    listeners: artist.stats?.listeners ?? null,
    playcount: artist.stats?.playcount ?? null,
    tags: (artist.tags?.tag ?? []).slice(0, 5).map(t => t.name),
    bio: cleanBio,
    similar: (artist.similar?.artist ?? []).slice(0, 5).map(a => ({
      name: a.name,
      url: a.url,
      image: a.image?.find(i => i.size === 'medium')?.['#text'] ?? null,
    })),
  }
}

/** Get artist's top tracks */
export async function getArtistTopTracks(name, limit = 8) {
  const data = await call({ method: 'artist.gettoptracks', artist: name, autocorrect: 1, limit })
  const tracks = data.toptracks?.track ?? []
  return tracks.map(t => ({
    name: t.name,
    playcount: parseInt(t.playcount, 10) || 0,
    url: t.url ?? null,
    listeners: parseInt(t.listeners, 10) || 0,
  }))
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
