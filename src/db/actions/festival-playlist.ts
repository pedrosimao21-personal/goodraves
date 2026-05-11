"use server";

import { spotifySearchPlaylist } from "@/services/spotify/client";

export type FestivalPlaylistData = {
  id: string;
  name: string;
  description: string;
  url: string | null;
  image: string | null;
  owner: string;
  tracksTotal: number;
};

/**
 * Find an existing Spotify playlist for a festival.
 * Searches Spotify for the festival name and returns the top matching playlist.
 */
export async function getFestivalPlaylist(
  festivalName: string
): Promise<FestivalPlaylistData | null> {
  if (!festivalName) return null;

  try {
    const sanitizedQuery = festivalName.replace(/\b20\d{2}\b/g, "").trim();
    const playlists = await spotifySearchPlaylist(sanitizedQuery, 1);
    if (playlists && playlists.length > 0) {
      return playlists[0];
    }
  } catch (err) {
    console.error("[festival-playlist] Error searching playlist:", err);
  }

  return null;
}
