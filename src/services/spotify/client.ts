/**
 * Spotify Web API client.
 *
 * NOTE: plain server-only transport module — deliberately NOT `"use server"`
 * (that would expose every function, incl. the token flow, as a public Server
 * Action and let anyone burn our API quota). Call only from `src/db/actions/*`.
 */

import { fetchWithTimeout } from "@/lib/fetch-timeout";

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

const TOKEN_REFRESH_BUFFER_MS = 60_000;
const MS_PER_SECOND = 1000;
const MIN_IMAGE_WIDTH = 300;
const MAX_IMAGE_WIDTH = 640;
const DEFAULT_ALBUM_LIMIT = 10;
const ARTIST_SEARCH_CANDIDATE_LIMIT = 5;
const DEFAULT_SHOW_LIMIT = 5;
const MAX_RETRY_AFTER_SECONDS = 10;
const PLAYLIST_ITEMS_LIMIT = 100;
/** Error message thrown when Spotify asks us to back off longer than we'll wait. */
export const SPOTIFY_RATE_LIMITED = "SPOTIFY_RATE_LIMITED";

/**
 * Loose cross-system identity comparison: lowercase, strip diacritics, strip
 * everything but letters/digits. Deliberately looser than
 * utils/text-normalizer.ts's normalizeArtistName (which only decodes entities
 * and NFC-normalizes, preserving case/punctuation for display) — this is for
 * comparing a name from one system (our stored/lineup name) against a name
 * from a different one (Spotify's), which can differ in case, accents, or
 * punctuation for the same real artist.
 */
function normalizeForMatch(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // combining diacritical marks (post-NFD accents)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}
// Max individual /artists/{id} requests to run concurrently. Spotify's
// "Get Several Artists" batch endpoint (/artists?ids=) now returns 403 for
// this app, so we fetch each artist one at a time and cap the fan-out to
// avoid tripping the 429 rate limiter on large lineups.
const ARTIST_FETCH_CONCURRENCY = 8;
// Of several exact-name matches, the top one is only trusted if it has at least
// this many times the runner-up's followers.
const FOLLOWER_DOMINANCE_RATIO = 3;
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

  const res = await fetchWithTimeout(SPOTIFY_TOKEN_URL, {
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

  const res = await fetchWithTimeout(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (res.status === 401) {
    tokenCache.invalidate();
    const newToken = await getAccessToken();
    const retry = await fetchWithTimeout(url, {
      headers: { Authorization: `Bearer ${newToken}` },
    });
    if (!retry.ok) throw new Error(`Spotify error ${retry.status}`);
    return retry.json();
  }

  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get("Retry-After") ?? "1", 10);
    // Spotify can answer with a Retry-After of many hours (57834s observed)
    // once an app's quota is exhausted. Waiting that out would hang a user's
    // request (or a cron run) indefinitely — fail fast instead, with an error
    // callers can recognize and treat as "couldn't check", never "no match".
    if (!Number.isFinite(retryAfter) || retryAfter > MAX_RETRY_AFTER_SECONDS) {
      console.warn(`[spotify] Rate limited on ${path}; Retry-After ${retryAfter}s exceeds cap, giving up`);
      throw new Error(SPOTIFY_RATE_LIMITED);
    }
    console.warn(`[spotify] Rate limited on ${path}; retrying after ${retryAfter}s`);
    await new Promise((r) => setTimeout(r, retryAfter * MS_PER_SECOND));
    const retry = await fetchWithTimeout(url, {
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

/**
 * Search Spotify for an artist by name, requiring an exact (loosely
 * normalized) name match — never just "the top search result". Spotify's
 * search is a relevance ranking, not a lookup: for a name like "Maddix" it
 * can rank an unrelated, more-popular artist (a country singer, in one
 * observed case) above the real match, and the previous genre-based
 * disambiguation never actually ran — Spotify's search endpoint no longer
 * returns `genres` on results, so that check silently always fell through to
 * "just take the top result" for every single call. Returning null on no
 * exact match (rather than a guess) is deliberate: no image beats the wrong
 * artist's image.
 */
export async function spotifySearchArtist(name: string) {
  const data = await apiFetch("/search", {
    q: name,
    type: "artist",
    limit: ARTIST_SEARCH_CANDIDATE_LIMIT,
  });

  const candidates: any[] = data.artists?.items ?? [];
  if (!candidates.length) return null;

  const target = normalizeForMatch(name);
  const exactMatches = candidates.filter(a => normalizeForMatch(a.name ?? "") === target);
  if (!exactMatches.length) return null;

  // Several accounts can share an exact name. Only a clearly dominant one is
  // taken as the intended artist: a development-mode Spotify app sees 0
  // followers for everyone, so the ranking can't tell them apart and picking
  // one would be a coin flip. No match beats the wrong person.
  exactMatches.sort((a, b) => (b.followers?.total ?? 0) - (a.followers?.total ?? 0));
  if (exactMatches.length > 1 && !isClearlyMostFollowed(exactMatches[0], exactMatches[1])) return null;

  return normalizeArtist(exactMatches[0]);
}

/** The top account has real followers and at least FOLLOWER_DOMINANCE_RATIO times the runner-up's. */
function isClearlyMostFollowed(top: any, runnerUp: any): boolean {
  const topFollowers = top.followers?.total ?? 0;
  return topFollowers > 0 && topFollowers >= FOLLOWER_DOMINANCE_RATIO * (runnerUp.followers?.total ?? 0);
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
    ownerId: p.owner?.id ?? "",
    tracksTotal: p.tracks?.total ?? p.items?.total ?? 0,
  }));
}

/**
 * Artist names across a playlist's first page of tracks — used to check a
 * candidate festival playlist against the festival's lineup. Returns null
 * (not []) when the playlist's contents can't be read at all: Spotify has
 * been restricting playlist-content access for client-credentials apps, and
 * "couldn't check" must never be mistaken for "no lineup artists in it".
 * The endpoint was renamed from /tracks to /items; try both.
 */
export async function spotifyGetPlaylistArtistNames(playlistId: string): Promise<string[] | null> {
  for (const path of [`/playlists/${playlistId}/items`, `/playlists/${playlistId}/tracks`]) {
    try {
      const data = await apiFetch(path, { limit: PLAYLIST_ITEMS_LIMIT, market: SPOTIFY_MARKET });
      return (data.items ?? []).flatMap((entry: any) =>
        ((entry?.track ?? entry?.item)?.artists ?? []).map((a: any) => a?.name).filter(Boolean)
      );
    } catch (err) {
      if (!(err instanceof Error && /Spotify error (403|404)\b/.test(err.message))) throw err;
    }
  }
  return null;
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
