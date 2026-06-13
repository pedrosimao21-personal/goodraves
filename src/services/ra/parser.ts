/**
 * Parsing utilities for Resident Advisor data.
 * Handles RA lineup text, GraphQL response mapping, and JSONL import files.
 */

import { type RAEventRaw } from "./client";
import { normalizeCountryName } from "@/utils/location-normalizer";
import {
  type LineupEntry,
  B2B_CONNECTOR_PATTERN,
  flattenLineupNames,
} from "@/services/lineup-types";

/** RA artist ID mapping: artist name → RA numeric artist ID (or null). */
export type RALineupResult = {
  entries: LineupEntry[];
  raArtistIds: Record<string, string | null>;
};

/** A single artist extracted from an `<artist>` tag or plain text within a line. */
type RawArtist = {
  name: string;
  raArtistId: string | null;
};

/**
 * Pattern matching time-range prefixes in plain-text RA lineup lines.
 * Matches formats like "01:00 - 03:00 ", "01:00-03:00 | ", "20:00 - 22:00: ".
 */
const TIME_PREFIX_PATTERN = /^\d{2}:\d{2}\s*[-–]\s*\d{2}:\d{2}\s*[:|]?\s*/;

/**
 * Pattern matching entries that are pure junk (not valid artist names).
 * Includes: lone punctuation, modifiers without a name, tab-separated stage data.
 */
const JUNK_ENTRY_PATTERN = /^(?:[&,!|.:\-–\s]+|\((?:LIVE|DJ SET|HYBRID|PA)\)|.*\t.*)$/i;

/** Returns true if the name is a valid artist entry worth keeping. */
function isValidArtistName(name: string): boolean {
  if (name.length === 0) return false;
  if (name.length > 200) return false;
  if (JUNK_ENTRY_PATTERN.test(name)) return false;
  // Pure time-only entries like "12:00-14:00" with no artist after
  if (/^\d{2}:\d{2}\s*[-–]\s*\d{2}:\d{2}\s*$/.test(name)) return false;
  return true;
}

/** Strip time-range prefix from a plain-text artist name if present. */
function stripTimePrefix(name: string): string {
  return name.replace(TIME_PREFIX_PATTERN, "").trim();
}

/**
 * Extract all artist tags and plain-text artist names from a single lineup line.
 * Returns raw artists in order of appearance, plus the text segments between them
 * for B2B connector detection.
 */
function extractArtistsFromLine(line: string): {
  artists: RawArtist[];
  connectors: string[];
} {
  const tagPattern = /<artist\s+id="(\d+)"[^>]*>(.*?)<\/artist>/g;
  const foundArtists: RawArtist[] = [];
  const connectors: string[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tagPattern.exec(line)) !== null) {
    const textBefore = line.slice(lastIndex, match.index).replace(/<[^>]+>/g, "").trim();

    if (foundArtists.length > 0) {
      connectors.push(textBefore);
    } else if (textBefore && !/^hosted by/i.test(textBefore)) {
      // Plain-text artist before the first tag — strip time prefix and validate
      const cleaned = stripTimePrefix(textBefore);
      if (isValidArtistName(cleaned)) {
        foundArtists.push({ name: cleaned, raArtistId: null });
        connectors.push("");
      }
    }

    const name = match[2].trim();
    if (name) {
      foundArtists.push({ name, raArtistId: match[1] });
    }

    lastIndex = match.index + match[0].length;
  }

  const remaining = line.slice(lastIndex).replace(/<[^>]+>/g, "").trim();
  if (remaining && !/^hosted by/i.test(remaining)) {
    const cleaned = stripTimePrefix(remaining);
    if (isValidArtistName(cleaned)) {
      if (foundArtists.length > 0) {
        connectors.push(cleaned);
        foundArtists.push({ name: cleaned, raArtistId: null });
      } else {
        foundArtists.push({ name: cleaned, raArtistId: null });
      }
    }
  }

  return { artists: foundArtists, connectors };
}

/**
 * Determine whether the connectors between artists on a line indicate a B2B set.
 * All connectors must match the B2B pattern for the line to qualify.
 */
function isB2bLine(connectors: string[]): boolean {
  if (connectors.length === 0) return false;
  return connectors.every((c) => B2B_CONNECTOR_PATTERN.test(c));
}

/**
 * Build a display name for a B2B set, preserving the original connectors.
 * E.g. "Artist A b2b Artist B" or "Artist A & Artist B".
 */
function buildB2bOriginalName(
  artistNames: string[],
  connectors: string[]
): string {
  let result = artistNames[0];
  for (let i = 0; i < connectors.length; i++) {
    const connector = connectors[i].trim() || "b2b";
    const nextName = artistNames[i + 1];
    if (nextName) {
      result += ` ${connector} ${nextName}`;
    }
  }
  return result;
}

/**
 * Parse RA's `lineup` text field which contains both linked artists
 * (wrapped in `<artist id="...">Name</artist>`) and plain-text artist names.
 * Detects B2B sets by checking connectors between consecutive artists on the same line.
 * Returns shared `LineupEntry` types plus a separate RA artist ID mapping.
 */
export function parseRALineup(
  lineupText: string | null | undefined,
  fallbackArtists?: string[]
): RALineupResult {
  if (!lineupText) {
    const entries: LineupEntry[] = (fallbackArtists ?? []).map((name) => ({
      type: "solo" as const,
      name,
    }));
    return { entries, raArtistIds: {} };
  }

  const seen = new Set<string>();
  const entries: LineupEntry[] = [];
  const raArtistIds: Record<string, string | null> = {};
  const hasArtistTags = /<artist\s+id="/.test(lineupText);

  for (const rawLine of lineupText.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    // Strip time prefix from the raw line before extraction for plain-text lineups
    const processedLine = hasArtistTags ? line : stripTimePrefix(line);
    if (!processedLine) continue;

    const { artists: lineArtists, connectors } = extractArtistsFromLine(processedLine);
    if (lineArtists.length === 0) continue;

    // When the lineup uses <artist> tags, plain-text-only lines are
    // stage/room headers (e.g. "Club", "Colorfloor") and must be skipped.
    const isPlainTextOnly = lineArtists.every((a) => a.raArtistId === null);
    if (hasArtistTags && isPlainTextOnly) continue;

    if (lineArtists.length >= 2 && isB2bLine(connectors)) {
      const members: string[] = [];
      for (const artist of lineArtists) {
        if (!isValidArtistName(artist.name)) continue;
        if (!seen.has(artist.name)) {
          seen.add(artist.name);
          raArtistIds[artist.name] = artist.raArtistId;
        }
        members.push(artist.name);
      }

      if (members.length >= 2) {
        const originalName = buildB2bOriginalName(members, connectors);
        entries.push({ type: "b2b", originalName, members });
      }
    } else {
      for (const artist of lineArtists) {
        if (!isValidArtistName(artist.name)) continue;
        if (seen.has(artist.name)) continue;
        seen.add(artist.name);
        raArtistIds[artist.name] = artist.raArtistId;
        entries.push({ type: "solo", name: artist.name });
      }
    }
  }

  return { entries, raArtistIds };
}

/** Extract just the artist names from a lineup result (convenience helper). */
export function lineupEntryNames(result: RALineupResult): string[] {
  return flattenLineupNames(result.entries);
}

/** Mapped RA search result ready for display or DB persistence */
export type RASearchResult = {
  raId: string;
  name: string;
  date: string | null;
  endDate: string | null;
  venue: string | null;
  location: string | null;
  imageUrl: string | null;
  lineup: string[];
};

/** Map raw RA event data to a normalised search result */
export function mapRAEventToSearchResult(e: RAEventRaw): RASearchResult | null {
  if (!e?.id) return null;

  const date = e.startTime
    ? new Date(e.startTime).toISOString().slice(0, 10)
    : null;
  const endDate = e.endTime
    ? new Date(e.endTime).toISOString().slice(0, 10)
    : null;

  const venueName = e.venue?.name ?? null;
  const areaName = e.venue?.area?.name ?? null;
  const countryName = e.venue?.area?.country?.name
    ? normalizeCountryName(e.venue.area.country.name)
    : null;
  const location =
    [areaName, countryName].filter(Boolean).join(", ") || null;

  const artistsFallback = (e.artists ?? [])
    .map((a) => a?.name)
    .filter(Boolean) as string[];

  return {
    raId: String(e.id),
    name: e.title ?? "Untitled Event",
    date,
    endDate,
    venue: venueName,
    location,
    imageUrl: e.images?.[0]?.filename ?? null,
    lineup: lineupEntryNames(parseRALineup(e.lineup, artistsFallback)),
  };
}
