"use server";

const BASE_URL = "https://ws.audioscrobbler.com/2.0/";
const API_KEY = process.env.LASTFM_KEY;
const PLACEHOLDER_KEY = "your_lastfm_api_key_here";
const MIN_BIO_PARAGRAPH_LENGTH = 10;
const MAX_GENRE_TAGS = 5;
const MAX_SIMILAR_ARTISTS = 5;
const DEFAULT_TOP_TRACKS_LIMIT = 8;

async function call(params: Record<string, any>) {
  if (!API_KEY || API_KEY === PLACEHOLDER_KEY) {
    throw new Error("NO_LASTFM_KEY");
  }

  const url = new URL(BASE_URL);
  Object.entries({ ...params, api_key: API_KEY, format: "json" }).forEach(
    ([k, v]) => url.searchParams.set(k, String(v))
  );

  const res = await fetch(url, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Last.fm error ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(`Last.fm: ${data.message}`);
  return data;
}

function extractTagNames(tags: string[]): string[] {
  if (!tags) return [];
  const seen = new Set<string>();
  return tags.reduce<string[]>((acc, tag) => {
    const normalized = tag.toLowerCase().trim();
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      acc.push(normalized);
    }
    return acc;
  }, []);
}

export async function lastfmGetArtistInfo(name: string) {
  const data = await call({
    method: "artist.getinfo",
    artist: name,
    autocorrect: 1,
  });
  const artist = data.artist;

  const images = artist.image ?? [];
  const imageUrl =
    images.find((i: any) => i.size === "extralarge")?.["#text"] ??
    images.find((i: any) => i.size === "large")?.["#text"] ??
    null;

  const bio = artist.bio?.content ?? artist.bio?.summary ?? "";
  let cleanBio = bio
    .replace(/<a href="[^"]*">Read more on Last\.fm<\/a>/gi, "")
    .trim();
  cleanBio = cleanBio
    .replace(
      /User-contributed text is available under the Creative Commons By-SA License; additional terms may apply\./gi,
      ""
    )
    .trim();

  if (cleanBio.includes("1. ") && cleanBio.includes("2. ")) {
    const parts = cleanBio
      .split(/\b\d+\. /g)
      .filter((p: string) => p.trim().length > MIN_BIO_PARAGRAPH_LENGTH);
    if (parts.length > 1) {
      const electronicKeywords = [
        "dj",
        "techno",
        "electronic",
        "house",
        "rave",
        "producer",
        "trance",
        "berlin",
        "club",
      ];
      const bestPart = parts.find((p: string) =>
        electronicKeywords.some((k) => p.toLowerCase().includes(k))
      );
      if (bestPart) cleanBio = bestPart.trim();
    }
  }

  return {
    name: artist.name,
    mbid: artist.mbid ?? null,
    url: artist.url ?? null,
    image: imageUrl && imageUrl !== "" ? imageUrl : null,
    listeners: artist.stats?.listeners ?? null,
    playcount: artist.stats?.playcount ?? null,
    tags: extractTagNames(
      (artist.tags?.tag ?? []).slice(0, MAX_GENRE_TAGS).map((t: any) => t.name)
    ),
    bio: cleanBio,
    similar: (artist.similar?.artist ?? []).slice(0, MAX_SIMILAR_ARTISTS).map((a: any) => ({
      name: a.name,
      url: a.url,
      image:
        a.image?.find((i: any) => i.size === "medium")?.["#text"] ?? null,
    })),
  };
}

export async function lastfmGetArtistTopTracks(name: string, limit = DEFAULT_TOP_TRACKS_LIMIT) {
  const data = await call({
    method: "artist.gettoptracks",
    artist: name,
    autocorrect: 1,
    limit,
  });
  const tracks = data.toptracks?.track ?? [];
  return tracks
    .map((t: any) => ({
      name: t.name,
      playcount: parseInt(t.playcount, 10) || 0,
      url: t.url ?? null,
      listeners: parseInt(t.listeners, 10) || 0,
    }))
    .sort((a: any, b: any) => b.playcount - a.playcount);
}

// ── Tag-based Discovery Functions ──────────────────────────────────────────

export type TagInfo = {
  name: string;
  url: string | null;
  reach: number;
  taggings: number;
  wiki: string | null;
};

export type TagTopAlbum = {
  name: string;
  artist: string;
  url: string | null;
  image: string | null;
};

export type TopTag = {
  name: string;
  count: number;
  url: string | null;
};

/**
 * Get metadata for a tag including description/wiki and usage statistics.
 * Uses the tag.getinfo Last.fm endpoint.
 */
export async function lastfmGetTagInfo(
  tag: string,
  lang = "en"
): Promise<TagInfo | null> {
  try {
    const data = await call({ method: "tag.getinfo", tag, lang });
    const t = data.tag;
    if (!t) return null;

    const rawWiki: string = t.wiki?.content ?? t.wiki?.summary ?? "";
    const wiki = rawWiki
      .replace(/<a href="[^"]*">Read more on Last\.fm<\/a>/gi, "")
      .replace(/User-contributed text is available[^.]*\./gi, "")
      .trim() || null;

    return {
      name: t.name ?? tag,
      url: t.url ?? null,
      reach: parseInt(t.reach, 10) || 0,
      taggings: parseInt(t.taggings, 10) || 0,
      wiki,
    };
  } catch {
    return null;
  }
}

/**
 * Get the top albums tagged with a specific genre/tag.
 * Uses the tag.gettopalbums Last.fm endpoint.
 */
export async function lastfmGetTagTopAlbums(
  tag: string,
  limit = 12
): Promise<TagTopAlbum[]> {
  try {
    const data = await call({ method: "tag.gettopalbums", tag, limit });
    return (data.topalbums?.album ?? []).map((a: any) => ({
      name: a.name,
      artist: a.artist?.name ?? "",
      url: a.url ?? null,
      image:
        a.image?.find((i: any) => i.size === "large")?.["#text"] ||
        a.image?.find((i: any) => i.size === "medium")?.["#text"] ||
        null,
    }));
  } catch {
    return [];
  }
}

/**
 * Get the top global tags on Last.fm sorted by popularity.
 * Uses the tag.getTopTags Last.fm endpoint.
 */
export async function lastfmGetTopTags(): Promise<TopTag[]> {
  try {
    const data = await call({ method: "tag.getTopTags" });
    return (data.toptags?.tag ?? []).map((t: any) => ({
      name: t.name,
      count: parseInt(t.count, 10) || 0,
      url: t.url ? `https://www.last.fm/tag/${encodeURIComponent(t.name)}` : null,
    }));
  } catch {
    return [];
  }
}

/**
 * Get tags similar to the given tag.
 * Uses the tag.getSimilar Last.fm endpoint.
 * Note: this endpoint often returns empty results for many tags.
 */
export async function lastfmGetSimilarTags(tag: string): Promise<string[]> {
  try {
    const data = await call({ method: "tag.getsimilar", tag });
    return (data.similartags?.tag ?? []).map((t: any) => t.name as string);
  } catch {
    return [];
  }
}

export type TagTopArtist = {
  name: string;
  url: string | null;
  image: string | null;
};

export type TagTopTrack = {
  name: string;
  artist: string;
  url: string | null;
  image: string | null;
};

/**
 * Get the top artists tagged with a specific genre/tag.
 * Uses the tag.gettopartists Last.fm endpoint.
 */
export async function lastfmGetTagTopArtists(
  tag: string,
  limit = 6
): Promise<TagTopArtist[]> {
  try {
    const data = await call({
      method: "tag.gettopartists",
      tag,
      limit,
    });

    return (data.topartists?.artist ?? []).map((a: any) => ({
      name: a.name,
      url: a.url ?? null,
      image:
        a.image?.find((i: any) => i.size === "large")?.["#text"] ||
        a.image?.find((i: any) => i.size === "medium")?.["#text"] ||
        null,
    }));
  } catch {
    return [];
  }
}

/**
 * Get the top tracks tagged with a specific genre/tag.
 * Uses the tag.gettoptracks Last.fm endpoint.
 */
export async function lastfmGetTagTopTracks(
  tag: string,
  limit = 6
): Promise<TagTopTrack[]> {
  try {
    const data = await call({
      method: "tag.gettoptracks",
      tag,
      limit,
    });

    return (data.toptracks?.track ?? []).map((t: any) => ({
      name: t.name,
      artist: t.artist?.name ?? "",
      url: t.url ?? null,
      image:
        t.image?.find((i: any) => i.size === "medium")?.["#text"] ||
        t.image?.find((i: any) => i.size === "small")?.["#text"] ||
        null,
    }));
  } catch {
    return [];
  }
}
