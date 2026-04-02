/**
 * Spotify Web API client
 * Docs: https://developer.spotify.com/documentation/web-api
 *
 * Uses Client Credentials flow (no user login required).
 * Add VITE_SPOTIFY_CLIENT_ID and VITE_SPOTIFY_CLIENT_SECRET to .env
 */

const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID
const CLIENT_SECRET = import.meta.env.VITE_SPOTIFY_CLIENT_SECRET

let _token = null
let _tokenExpiry = 0

export const HAS_SPOTIFY = !!(CLIENT_ID && CLIENT_SECRET)

/** Get a valid access token, refreshing if expired */
async function getAccessToken() {
  // Refresh 60 seconds before actual expiry
  if (_token && Date.now() < _tokenExpiry - 60_000) {
    return _token
  }

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + btoa(`${CLIENT_ID}:${CLIENT_SECRET}`),
    },
    body: 'grant_type=client_credentials',
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Spotify auth error ${res.status}: ${errText}`)
  }

  const data = await res.json()
  _token = data.access_token
  _tokenExpiry = Date.now() + data.expires_in * 1000
  return _token
}

/** Make an authenticated GET request to the Spotify API */
async function apiFetch(path, params = {}) {
  if (!HAS_SPOTIFY) throw new Error('NO_SPOTIFY_KEYS')

  const token = await getAccessToken()
  const url = new URL(`https://api.spotify.com/v1${path}`)
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v)
  })

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (res.status === 401) {
    // Token expired unexpectedly — clear and retry once
    _token = null
    _tokenExpiry = 0
    const newToken = await getAccessToken()
    const retry = await fetch(url, {
      headers: { Authorization: `Bearer ${newToken}` },
    })
    if (!retry.ok) throw new Error(`Spotify error ${retry.status}`)
    return retry.json()
  }

  if (!res.ok) {
    throw new Error(`Spotify error ${res.status}`)
  }

  return res.json()
}

/**
 * Search for an artist by name. Returns the best match.
 * @returns {{ id, name, image, genres, popularity, url, followers }} | null
 */
export async function searchArtist(name) {
  const data = await apiFetch('/search', {
    q: name,
    type: 'artist',
    limit: 1,
  })

  const artist = data.artists?.items?.[0]
  if (!artist) return null

  return normalizeArtist(artist)
}

/**
 * Get full artist details by Spotify ID.
 */
export async function getArtist(spotifyId) {
  const data = await apiFetch(`/artists/${spotifyId}`)
  return normalizeArtist(data)
}

/**
 * Get an artist's albums (discography).
 * @returns {Array<{ id, name, releaseDate, image, url, type }>}
 */
export async function getArtistAlbums(spotifyId, limit = 10) {
  const data = await apiFetch(`/artists/${spotifyId}/albums`, { 
    limit,
    include_groups: 'album,single',
    market: 'NL'
  })

  return (data.items ?? []).map(a => ({
    id: a.id,
    name: a.name,
    releaseDate: a.release_date,
    image: a.images?.[0]?.url ?? null,
    url: a.external_urls?.spotify ?? null,
    type: a.album_type, // 'album' or 'single'
  }))
}

/**
 * Search for podcasts/shows matching the artist's name.
 * Useful for finding DJ radio shows (e.g. "Tiesto's Club Life").
 * @returns {Array<{ id, name, publisher, image, url, description }>}
 */
export async function searchArtistShows(name, limit = 5) {
  const data = await apiFetch('/search', {
    q: name,
    type: 'show',
    limit,
    market: 'NL'
  })

  return (data.shows?.items ?? []).map(s => ({
    id: s.id,
    name: s.name,
    publisher: s.publisher,
    image: s.images?.[0]?.url ?? null,
    url: s.external_urls?.spotify ?? null,
    description: s.description ?? '',
  }))
}

/** Normalize a Spotify artist object to a clean shape */
function normalizeArtist(a) {
  const images = a.images ?? []
  // Prefer medium-size image (300px), fallback to largest
  const image = images.find(i => i.width >= 300 && i.width <= 640)?.url
    ?? images[0]?.url
    ?? null

  return {
    id: a.id,
    name: a.name,
    image,
    genres: normalizeGenres(a.genres ?? []),
    popularity: a.popularity ?? 0,
    url: a.external_urls?.spotify ?? null,
    followers: a.followers?.total ?? 0,
  }
}

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
