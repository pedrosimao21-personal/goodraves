"use server";

import { spotifySearchArtistShows } from "@/services/spotify/client";

export type ArtistShow = {
  id: string;
  name: string;
  publisher: string;
  image: string | null;
  url: string | null;
  description: string;
};

/**
 * Search for Spotify podcast shows related to an artist name.
 * Used for the "Upcoming Shows" section on the artist profile page.
 * Returns up to 5 results, filtered to only shows that are likely DJ sets/mixes.
 */
export async function getArtistShows(artistName: string): Promise<ArtistShow[]> {
  try {
    const shows = await spotifySearchArtistShows(artistName, 8);

    // Filter shows to ones that are specifically about the artist (not generic)
    const nameNorm = artistName.toLowerCase().replace(/[^a-z0-9]/g, "");
    return shows
      .filter((s: ArtistShow) => {
        const pubNorm = s.publisher?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "";
        const nameNormShow = s.name?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "";
        return pubNorm.includes(nameNorm) || nameNormShow.includes(nameNorm);
      })
      .slice(0, 5);
  } catch {
    return [];
  }
}
