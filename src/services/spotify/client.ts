/**
 * Spotify Web API client.
 *
 * NOTE: plain server-only transport module — deliberately NOT `"use server"`
 * (that would expose every function, incl. the token flow, as a public Server
 * Action and let anyone burn our API quota). Call only from `src/db/actions/*`.
 */

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

const TOKEN_REFRESH_BUFFER_MS = 60_000;
const MS_PER_SECOND = 1000;
const MIN_IMAGE_WIDTH = 300;
const MAX_IMAGE_WIDTH = 640;
const DEFAULT_ALBUM_LIMIT = 10;
const ARTIST_SEARCH_CANDIDATE_LIMIT = 5;

// Genre keywords that indicate an electronic music artist.
// Used to disambiguate between multiple search results (e.g. "Franck" the DJ vs César Franck).
const ELECTRONIC_GENRE_KEYWORDS = [
  'electronic', 'techno', 'house', 'trance', 'edm', 'dance',
  'drum and bass', 'dnb', 'dubstep', 'ambient', 'industrial',
  'electro', 'rave', 'hardcore', 'psytrance', 'minimal',
]

function hasElectronicGenre(genres: string[]): boolean {
  return genres.some(genre =>
    ELECTRONIC_GENRE_KEYWORDS.some(keyword => genre.toLowerCase().includes(keyword))
  )
}
const DEFAULT_SHOW_LIMIT = 5;
// Max individual /artists/{id} requests to run concurrently. Spotify's
// "Get Several Artists" batch endpoint (/artists?ids=) now returns 403 for
// this app, so we fetch each artist one at a time and cap the fan-out to
// avoid tripping the 429 rate limiter on large lineups.
const ARTIST_FETCH_CONCURRENCY = 8;
const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const SPOTIFY_API_BASE = "https://api.spotify.com/v1";
const SPOTIFY_MARKET = "NL";

const tokenCache = (() => {
  let token: string | null = null;
  let expiry = 0;

  return {
    isValid(): boolean {
      return !!token && Date.now() < expiry - TOKEN_REFRESH_BUFFER_MS;
    },
    get(): string | null {
      return token;
    },
    set(newToken: string, expiresInSeconds: number): void {
      token = newToken;
      expiry = Date.now() + expiresInSeconds * MS_PER_SECOND;
    },
    invalidate(): void {
      token = null;
      expiry = 0;
    },
  };
})();

async function getAccessToken() {
  if (tokenCache.isValid()) {
    return tokenCache.get()!;
  }

  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization:
        "Basic " +
        Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64"),
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Spotify auth error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  tokenCache.set(data.access_token, data.expires_in);
  return data.access_token;
}

async function apiFetch(path: string, params: Record<string, any> = {}) {
  if (!CLIENT_ID || !CLIENT_SECRET) throw new Error("NO_SPOTIFY_KEYS");

  const token = await getAccessToken();
  const url = new URL(`${SPOTIFY_API_BASE}${path}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
  });

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (res.status === 401) {
    tokenCache.invalidate();
    const newToken = await getAccessToken();
    const retry = await fetch(url, {
      headers: { Authorization: `Bearer ${newToken}` },
    });
    if (!retry.ok) throw new Error(`Spotify error ${retry.status}`);
    return retry.json();
  }

  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get("Retry-After") ?? "1", 10);
    console.warn(`[spotify] Rate limited on ${path}; retrying after ${retryAfter}s`);
    await new Promise((r) => setTimeout(r, retryAfter * MS_PER_SECOND));
    const retry = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!retry.ok) throw new Error(`Spotify error ${retry.status}`);
    return retry.json();
  }

  if (!res.ok) throw new Error(`Spotify error ${res.status}`);
  return res.json();
}

function normalizeArtist(a: any) {
  const images = a.images ?? [];
  const image =
    images.find((i: any) => i.width >= MIN_IMAGE_WIDTH && i.width <= MAX_IMAGE_WIDTH)?.url ??
    images[0]?.url ??
    null;

  return {
    id: a.id,
    name: a.name,
    image,
    popularity: a.popularity ?? 0,
    followers: a.followers?.total ?? 0,
  };
}

export async function spotifySearchArtist(name: string) {
  const data = await apiFetch("/search", {
    q: name,
    type: "artist",
    limit: ARTIST_SEARCH_CANDIDATE_LIMIT,
  });

  const candidates: any[] = data.artists?.items ?? [];
  if (!candidates.length) return null;

  // Prefer the first result that has at least one electronic genre tag.
  // This disambiguates e.g. "Franck" (DJ) from "César Franck" (classical composer).
  const electronicMatch = candidates.find(a => hasElectronicGenre(a.genres ?? []));
  const artist = electronicMatch ?? candidates[0];

  return normalizeArtist(artist);
}

export async function spotifyGetArtist(spotifyId: string) {
  const data = await apiFetch(`/artists/${spotifyId}`);
  return normalizeArtist(data);
}

export async function spotifySearchPlaylist(query: string, limit = 1) {
  const data = await apiFetch("/search", {
    q: query,
    type: "playlist",
    limit,
  });

  const playlists = (data.playlists?.items ?? []).filter((p: any) => p !== null && p.id);
  return playlists.map((p: any) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    url: p.external_urls?.spotify ?? null,
    image: p.images?.[0]?.url ?? null,
    owner: p.owner?.display_name ?? "",
    tracksTotal: p.tracks?.total ?? 0,
  }));
}

export async function spotifyGetArtistTopTracks(spotifyId: string) {
  try {
    const data = await apiFetch(`/artists/${spotifyId}/top-tracks`, {
      market: SPOTIFY_MARKET,
    });

    return (data.tracks ?? []).slice(0, 8).map((t: any) => ({
      name: t.name,
      playcount: t.popularity ?? 0,
      url: t.external_urls?.spotify ?? null,
      listeners: 0,
      previewUrl: t.preview_url ?? null,
    }));
  } catch (err) {
    if (err instanceof Error && err.message.includes("403")) {
      console.warn(`[spotify] Top tracks unavailable for ${spotifyId} — endpoint requires user auth`);
      return [];
    }
    throw err;
  }
}
/**
 * Search Spotify for a specific track by artist + track name.
 * Returns the 30-second preview URL if available, or null.
 * Uses /search which works with client_credentials (no user auth needed).
 */
export async function spotifySearchTrackPreview(
  artistName: string,
  trackName: string
): Promise<string | null> {
  try {
    const data = await apiFetch("/search", {
      q: `artist:${artistName} track:${trackName}`,
      type: "track",
      limit: 1,
      market: SPOTIFY_MARKET,
    });
    return data.tracks?.items?.[0]?.preview_url ?? null;
  } catch {
    return null;
  }
}

export async function spotifyGetArtistAlbums(
  spotifyId: string,
  limit = DEFAULT_ALBUM_LIMIT
) {
  const data = await apiFetch(`/artists/${spotifyId}/albums`, {
    limit,
    include_groups: "album,single",
    market: SPOTIFY_MARKET,
  });

  return (data.items ?? []).map((a: any) => ({
    id: a.id,
    name: a.name,
    releaseDate: a.release_date,
    image: a.images?.[0]?.url ?? null,
    url: a.external_urls?.spotify ?? null,
    type: a.album_type,
  }));
}

export async function spotifySearchArtistShows(name: string, limit = DEFAULT_SHOW_LIMIT) {
  const data = await apiFetch("/search", {
    q: name,
    type: "show",
    limit,
    market: SPOTIFY_MARKET,
  });

  return (data.shows?.items ?? []).map((s: any) => ({
    id: s.id,
    name: s.name,
    publisher: s.publisher,
    image: s.images?.[0]?.url ?? null,
    url: s.external_urls?.spotify ?? null,
    description: s.description ?? "",
  }));
}

export async function hasSpotifyKeys() {
  return !!(CLIENT_ID && CLIENT_SECRET);
}

export async function spotifyGetRelatedArtists(spotifyId: string) {
  try {
    const data = await apiFetch(`/artists/${spotifyId}/related-artists`);
    return (data.artists ?? [])
      .filter((a: any) => a !== null && a.id)
      .slice(0, 6)
      .map(normalizeArtist);
  } catch (err) {
    if (err instanceof Error && err.message.includes("403")) {
      console.warn(`[spotify] Related artists unavailable for ${spotifyId} — endpoint requires user auth`);
      return [];
    }
    throw err;
  }
}

/**
 * Fetch multiple artists by Spotify ID and return a map of
 * spotifyId → normalized artist data.
 *
 * Implemented via individual "Get Artist" (/artists/{id}) requests rather than
 * the "Get Several Artists" batch endpoint (/artists?ids=), which Spotify now
 * returns 403 for on this app. Requests are fanned out in bounded-concurrency
 * chunks; an individual failure is skipped so one bad ID can't sink the rest.
 */
export async function spotifyGetArtistsBatch(
  ids: string[]
): Promise<Record<string, ReturnType<typeof normalizeArtist>>> {
  if (!ids.length) return {};

  const results: Record<string, ReturnType<typeof normalizeArtist>> = {};
  for (let i = 0; i < ids.length; i += ARTIST_FETCH_CONCURRENCY) {
    const chunk = ids.slice(i, i + ARTIST_FETCH_CONCURRENCY);
    const settled = await Promise.allSettled(chunk.map((id) => spotifyGetArtist(id)));
    settled.forEach((outcome, idx) => {
      if (outcome.status === "fulfilled" && outcome.value?.id) {
        results[chunk[idx]] = outcome.value;
      } else if (outcome.status === "rejected") {
        console.warn(
          `[spotify] Failed to fetch artist ${chunk[idx]}:`,
          outcome.reason instanceof Error ? outcome.reason.message : outcome.reason
        );
      }
    });
  }
  return results;
}

/**
 * Batch-search multiple artist names in parallel with a single server action call.
 * Returns a map of artistName → enriched artist data (or null if not found).
 */
export async function spotifySearchArtistsBatch(
  names: string[]
): Promise<Record<string, Awaited<ReturnType<typeof spotifySearchArtist>>>> {
  const results = await Promise.all(
    names.map(async (name) => {
      try {
        const result = await spotifySearchArtist(name);
        return [name, result] as const;
      } catch {
        return [name, null] as const;
      }
    })
  );
  return Object.fromEntries(results);
}
