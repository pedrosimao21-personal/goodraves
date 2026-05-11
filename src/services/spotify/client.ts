"use server";

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

const TOKEN_REFRESH_BUFFER_MS = 60_000;
const MS_PER_SECOND = 1000;
const MIN_IMAGE_WIDTH = 300;
const MAX_IMAGE_WIDTH = 640;
const DEFAULT_ALBUM_LIMIT = 10;
const DEFAULT_SHOW_LIMIT = 5;
const BATCH_MAX_IDS = 50;
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
    limit: 1,
  });

  const artist = data.artists?.items?.[0];
  if (!artist) return null;
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

  const playlists = data.playlists?.items ?? [];
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
  const data = await apiFetch(`/artists/${spotifyId}/top-tracks`, {
    market: SPOTIFY_MARKET,
  });

  return (data.tracks ?? []).slice(0, 8).map((t: any) => ({
    name: t.name,
    playcount: t.popularity ?? 0, // Using popularity for playcount field compatibility
    url: t.external_urls?.spotify ?? null,
    listeners: 0,
    previewUrl: t.preview_url ?? null,
  }));
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

/**
 * Fetch up to 50 artists by Spotify ID in a single API call using the
 * "Get Several Artists" batch endpoint.
 * Returns a map of spotifyId → normalized artist data.
 */
export async function spotifyGetArtistsBatch(
  ids: string[]
): Promise<Record<string, ReturnType<typeof normalizeArtist>>> {
  if (!ids.length) return {};
  // Endpoint accepts max 50 IDs at a time
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += BATCH_MAX_IDS) chunks.push(ids.slice(i, i + BATCH_MAX_IDS));

  const results: Record<string, ReturnType<typeof normalizeArtist>> = {};
  for (const chunk of chunks) {
    const data = await apiFetch("/artists", { ids: chunk.join(",") });
    for (const artist of data.artists ?? []) {
      if (artist) results[artist.id] = normalizeArtist(artist);
    }
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
