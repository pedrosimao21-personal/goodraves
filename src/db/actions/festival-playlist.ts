"use server";

import { db } from "@/db";
import { inArray } from "drizzle-orm";
import { artists } from "@/db/schema";
import { lastfmGetArtistTopTracks } from "@/services/lastfm/client";

export type PlaylistTrack = {
  artistName: string;
  artistImage: string | null;
  trackName: string;
  spotifySearchUrl: string;
};

/**
 * Build a curated festival playlist preview.
 * First checks the DB for cached Last.fm top tracks.
 * For artists without cached tracks, fetches from Last.fm live.
 * Returns up to `tracksPerArtist` tracks per artist.
 */
export async function getFestivalPlaylistTracks(
  artistNames: string[],
  tracksPerArtist = 3
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

  await Promise.all(
    names.map(async (name) => {
      const row = byName.get(name);
      const artistImage = row?.imageUrl ?? null;

      let parsed: Array<{ name: string; playcount: number }> = [];

      // Try cached DB data first
      if (row?.lastfmTopTracks) {
        try {
          parsed = JSON.parse(row.lastfmTopTracks);
        } catch {
          parsed = [];
        }
      }

      // Fall back to live Last.fm fetch if no cached data
      if (!parsed.length) {
        try {
          const liveTracks = await lastfmGetArtistTopTracks(name);
          if (liveTracks?.length) parsed = liveTracks;
        } catch {
          // Last.fm unavailable for this artist
        }
      }

      parsed.slice(0, tracksPerArtist).forEach((t) => {
        tracks.push({
          artistName: name,
          artistImage,
          trackName: t.name,
          spotifySearchUrl: `https://open.spotify.com/search/${encodeURIComponent(name + " " + t.name)}`,
        });
      });
    })
  );

  return tracks;
}
