/**
 * Parsing utilities for Resident Advisor data.
 * Handles RA lineup text, GraphQL response mapping, and JSONL import files.
 */

import { type RAEventRaw } from "./client";
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
      // Plain-text artist before the first tag — treat as a standalone artist
      foundArtists.push({ name: textBefore, raArtistId: null });
      connectors.push("");
    }

    const name = match[2].trim();
    if (name) {
      foundArtists.push({ name, raArtistId: match[1] });
    }

    lastIndex = match.index + match[0].length;
  }

  const remaining = line.slice(lastIndex).replace(/<[^>]+>/g, "").trim();
  if (remaining && !/^hosted by/i.test(remaining)) {
    if (foundArtists.length > 0) {
      connectors.push(remaining);
      foundArtists.push({ name: remaining, raArtistId: null });
    } else {
      foundArtists.push({ name: remaining, raArtistId: null });
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

    const { artists: lineArtists, connectors } = extractArtistsFromLine(line);
    if (lineArtists.length === 0) continue;

    // When the lineup uses <artist> tags, plain-text-only lines are
    // stage/room headers (e.g. "Club", "Colorfloor") and must be skipped.
    const isPlainTextOnly = lineArtists.every((a) => a.raArtistId === null);
    if (hasArtistTags && isPlainTextOnly) continue;

    if (lineArtists.length >= 2 && isB2bLine(connectors)) {
      const members: string[] = [];
      for (const artist of lineArtists) {
        if (!seen.has(artist.name)) {
          seen.add(artist.name);
          raArtistIds[artist.name] = artist.raArtistId;
        }
        members.push(artist.name);
      }

      const originalName = buildB2bOriginalName(members, connectors);
      entries.push({ type: "b2b", originalName, members });
    } else {
      for (const artist of lineArtists) {
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
  const countryName = e.venue?.area?.country?.name ?? null;
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

// ── JSONL Import Parsing (for ra-scraper output files) ────────────────

/** Try multiple candidate keys in priority order, supports dot-notation */
function pick(obj: any, ...keys: string[]) {
  for (const k of keys) {
    const parts = k.split(".");
    let v = obj;
    for (const p of parts) v = v?.[p];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}

/** Normalise a date string to YYYY-MM-DD */
function normaliseDate(raw: string | null | undefined) {
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const d = new Date(raw);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return raw;
}

/** Parse a JSONL file and return an array of objects */
export function parseJSONL(file: File): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const lines = (e.target!.result as string)
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean);
        resolve(
          lines
            .map((line, i) => {
              try {
                return JSON.parse(line);
              } catch {
                console.warn(`Skipping malformed line ${i + 1}`);
                return null;
              }
            })
            .filter(Boolean)
        );
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

export type NormalisedEvent = {
  id: string;
  name: string;
  date: string | null;
  venue: { name: string; city: string };
  lineup: string[];
  link: string | null;
  source: string;
};

/** Build normalised event objects from raw RA scraper rows */
export function normaliseEvents(
  eventRows: any[],
  lineupRows: any[]
): { events: Record<string, NormalisedEvent>; skipped: number } {
  const lineupMap = buildLineupMap(lineupRows);
  const result: Record<string, NormalisedEvent> = {};
  let skipped = 0;

  eventRows.forEach((item) => {
    const rawId = String(
      pick(item, "id", "eventId", "ra_id", "raId", "slug") ?? ""
    );
    const name = pick(
      item,
      "title",
      "name",
      "eventTitle",
      "event_title",
      "eventName"
    );
    if (!name) {
      skipped++;
      return;
    }

    const id = `ra-${rawId.replace(/^ra-/, "")}`;
    const dateRaw = pick(
      item,
      "date",
      "startDate",
      "start_date",
      "eventDate",
      "event_date",
      "date_start",
      "dateStart",
      "datetime"
    );
    const venueName = pick(
      item,
      "venue",
      "venueName",
      "venue_name",
      "venue.name",
      "location"
    );
    const venueCity = pick(
      item,
      "city",
      "venueCity",
      "venue_city",
      "venue.city",
      "venue.address.city"
    );
    const link = pick(
      item,
      "link",
      "url",
      "contentUrl",
      "ra_url",
      "href",
      "eventUrl"
    );

    const lineup = resolveLineup(item, lineupMap, rawId);

    result[id] = {
      id,
      name,
      date: normaliseDate(dateRaw),
      venue: { name: venueName ?? "Unknown Venue", city: venueCity ?? "" },
      lineup,
      link: link ?? null,
      source: "ra",
    };
  });

  return { events: result, skipped };
}

function buildLineupMap(lineupRows: any[]): Record<string, string[]> {
  const lineupMap: Record<string, string[]> = {};

  lineupRows.forEach((item) => {
    const eventKey = String(
      pick(item, "eventId", "event_id", "id", "raEventId") ?? ""
    );
    if (!eventKey) return;
    if (!lineupMap[eventKey]) lineupMap[eventKey] = [];

    const arr = pick(item, "lineup", "artists", "lineup_artists");
    if (Array.isArray(arr)) {
      arr.forEach((a: any) => {
        const name =
          typeof a === "string" ? a : pick(a, "name", "artistName", "title");
        if (name) lineupMap[eventKey].push(name);
      });
      return;
    }
    const name = pick(
      item,
      "artist",
      "name",
      "artistName",
      "artist_name",
      "title"
    );
    if (name) lineupMap[eventKey].push(name);
  });

  return lineupMap;
}

function resolveLineup(
  item: any,
  lineupMap: Record<string, string[]>,
  rawId: string
): string[] {
  let lineup = lineupMap[rawId] ?? [];

  if (!lineup.length) {
    const inlineLineup = pick(
      item,
      "lineup",
      "artists",
      "lineup_artists",
      "performers"
    );
    if (Array.isArray(inlineLineup)) {
      lineup = inlineLineup
        .map((a: any) =>
          typeof a === "string"
            ? a
            : pick(a, "name", "artistName", "title") ?? ""
        )
        .filter(Boolean);
    }
  }

  if (!lineup.length) {
    const artist = pick(item, "artist", "headliner", "main_act");
    if (artist) lineup = [artist];
  }

  return [
    ...new Set(lineup.map((s: string) => String(s).trim()).filter(Boolean)),
  ];
}
