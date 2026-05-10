"use server";

import { db } from "@/db";
import { inArray } from "drizzle-orm";
import { artists } from "@/db/schema";

export type PlaylistTrack = {
  artistName: string;
  artistImage: string | null;
  trackName: string;
  spotifySearchUrl: string;
};

/**
 * Build a curated festival playlist preview.
 * Fetches up to `tracksPerArtist` top tracks from Last.fm for each artist in the lineup,
 * looking them up by name from the DB (where lastfmTopTracks are cached).
 */
export async function getFestivalPlaylistTracks(
  artistNames: string[],
  tracksPerArtist = 2
): Promise<PlaylistTrack[]> {
  if (!artistNames.length) return [];

  // Limit to first 20 artists to avoid huge payloads
  const names = artistNames.slice(0, 20);

  const rows = await db
    .select({
      name: artists.name,
      imageUrl: artists.imageUrl,
      lastfmTopTracks: artists.lastfmTopTracks,
    })
    .from(artists)
    .where(inArray(artists.name, names))
    .catch(() => []);

  const byName = new Map(rows.map((r) => [r.name, r] as [string, typeof r]));

  const tracks: PlaylistTrack[] = [];

  for (const name of names) {
    const row = byName.get(name);
    if (!row) continue;

    let parsed: Array<{ name: string; playcount: number }> = [];
    try {
      parsed = row.lastfmTopTracks ? JSON.parse(row.lastfmTopTracks) : [];
    } catch {
      parsed = [];
    }

    parsed.slice(0, tracksPerArtist).forEach((t) => {
      tracks.push({
        artistName: row.name,
        artistImage: row.imageUrl ?? null,
        trackName: t.name,
        spotifySearchUrl: `https://open.spotify.com/search/${encodeURIComponent(row.name + " " + t.name)}`,
      });
    });
  }

  return tracks;
}
