/**
 * Pure rules for "is this Spotify playlist really this festival's playlist?"
 * (used by db/actions/festival-playlist-core.ts). No network access.
 *
 * A playlist whose name merely contains the festival name is not enough —
 * anyone can title a playlist "Awakenings vibes". It must ALSO either be
 * owned by an account with the festival's own name (official playlists are
 * published by the festival's Spotify account: "Awakenings", "DGTL
 * Festival", …), or contain a meaningful part of the festival's lineup.
 */

import { coreTokens, normalizeText } from "./festival-match";

export type PlaylistCandidate = {
  id: string;
  name: string;
  owner: string;
  ownerId: string;
  tracksTotal: number;
};

const MIN_BRAND_CHARS = 3;
/** An owner name this short ("ade") would match inside far too many brands. */
const MIN_OWNER_CHARS = 4;
/** Lineup check: at least this many festival artists in the playlist… */
const MIN_LINEUP_ARTISTS_IN_PLAYLIST = 5;
/** …or, for a small lineup, at least this share of it. */
const MIN_LINEUP_SHARE_IN_PLAYLIST = 0.5;
const OWNER_NOISE = /festival|official|music|events?|playlists?|spotify/g;

function squashText(text: string): string {
  return normalizeText(text).replace(/\s+/g, "");
}

/** The festival's brand with spacing, years and filler removed: "Awakenings Festival 2026" → "awakenings". */
export function brandKey(festivalName: string): string | null {
  const brand = [...coreTokens(festivalName)].join("");
  return brand.length >= MIN_BRAND_CHARS ? brand : null;
}

export function nameContainsBrand(playlistName: string, brand: string): boolean {
  return squashText(playlistName).includes(brand);
}

/**
 * Owner is the festival's own account: "Awakenings", "DGTL Festival",
 * "awakeningsfestival" — or the brand's root for a named edition ("DGTL" for
 * "DGTL Amsterdam"). A longer owner name that merely contains the brand
 * ("Awakenings Fans") is someone else's account and doesn't count.
 */
export function isOwnedByBrand(candidate: PlaylistCandidate, brand: string): boolean {
  return [candidate.owner, candidate.ownerId].some((raw) => {
    const owner = squashText(raw).replace(OWNER_NOISE, "");
    return owner === brand || (owner.length >= MIN_OWNER_CHARS && brand.startsWith(owner));
  });
}

/** Does the playlist's artist list cover enough of the lineup to be about this festival? */
export function isLineupConfirmed(lineupNames: string[], playlistArtistNames: string[]): boolean {
  const lineup = new Set(lineupNames.map(squashText).filter(Boolean));
  if (lineup.size === 0) return false;
  const inPlaylist = new Set(playlistArtistNames.map(squashText));
  let matched = 0;
  for (const artist of lineup) if (inPlaylist.has(artist)) matched++;
  return matched >= MIN_LINEUP_ARTISTS_IN_PLAYLIST || (matched >= 2 && matched / lineup.size >= MIN_LINEUP_SHARE_IN_PLAYLIST);
}

/** Prefer a playlist for this year's edition, then the most complete one. */
export function rankCandidates(candidates: PlaylistCandidate[], festivalName: string): PlaylistCandidate[] {
  const year = festivalName.match(/\b(19|20)\d{2}\b/)?.[0];
  const mentionsYear = (c: PlaylistCandidate) => (year && c.name.includes(year) ? 1 : 0);
  return [...candidates].sort((a, b) => mentionsYear(b) - mentionsYear(a) || b.tracksTotal - a.tracksTotal);
}
