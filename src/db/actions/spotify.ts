"use server";

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

let _token: string | null = null;
let _tokenExpiry = 0;

async function getAccessToken() {
  if (_token && Date.now() < _tokenExpiry - 60_000) {
    return _token;
  }

  const res = await fetch("https://accounts.spotify.com/api/token", {
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
  _token = data.access_token;
  _tokenExpiry = Date.now() + data.expires_in * 1000;
  return _token;
}

async function apiFetch(path: string, params: Record<string, any> = {}) {
  if (!CLIENT_ID || !CLIENT_SECRET) throw new Error("NO_SPOTIFY_KEYS");

  const token = await getAccessToken();
  const url = new URL(`https://api.spotify.com/v1${path}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
  });

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 3600 }, // Cache artist data for 1 hour
  });

  if (res.status === 401) {
    _token = null;
    _tokenExpiry = 0;
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
    await new Promise((r) => setTimeout(r, retryAfter * 1000));
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
    images.find((i: any) => i.width >= 300 && i.width <= 640)?.url ??
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

export async function spotifyGetArtistAlbums(
  spotifyId: string,
  limit = 10
) {
  const data = await apiFetch(`/artists/${spotifyId}/albums`, {
    limit,
    include_groups: "album,single",
    market: "NL",
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

export async function spotifySearchArtistShows(name: string, limit = 5) {
  const data = await apiFetch("/search", {
    q: name,
    type: "show",
    limit,
    market: "NL",
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
  for (let i = 0; i < ids.length; i += 50) chunks.push(ids.slice(i, i + 50));

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
