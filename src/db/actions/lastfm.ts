"use server";

const BASE_URL = "https://ws.audioscrobbler.com/2.0/";
const API_KEY = process.env.LASTFM_KEY;

async function call(params: Record<string, any>) {
  if (!API_KEY || API_KEY === "your_lastfm_api_key_here") {
    throw new Error("NO_LASTFM_KEY");
  }

  const url = new URL(BASE_URL);
  Object.entries({ ...params, api_key: API_KEY, format: "json" }).forEach(
    ([k, v]) => url.searchParams.set(k, String(v))
  );

  const res = await fetch(url, {
    next: { revalidate: 3600 }, // Cache for 1 hour
  });
  if (!res.ok) throw new Error(`Last.fm error ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(`Last.fm: ${data.message}`);
  return data;
}

function normalizeGenres(genres: string[]) {
  if (!genres) return [];
  const BLACKLIST = new Set(["swedish", "dancehall", "rave"]);
  const MAPPINGS: Record<string, string> = {
    electronica: "electronic",
    "acid techno": "acid",
    "minimal techno": "minimal",
  };

  return genres
    .map((g) => g.toLowerCase().trim())
    .filter((g) => !BLACKLIST.has(g))
    .map((g) => MAPPINGS[g] || g)
    .filter((v, i, a) => a.indexOf(v) === i);
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
      .filter((p: string) => p.trim().length > 10);
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
    tags: normalizeGenres(
      (artist.tags?.tag ?? []).slice(0, 5).map((t: any) => t.name)
    ),
    bio: cleanBio,
    similar: (artist.similar?.artist ?? []).slice(0, 5).map((a: any) => ({
      name: a.name,
      url: a.url,
      image:
        a.image?.find((i: any) => i.size === "medium")?.["#text"] ?? null,
    })),
  };
}

export async function lastfmGetArtistTopTracks(name: string, limit = 8) {
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
