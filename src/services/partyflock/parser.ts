/**
 * Parse partyflock.nl HTML pages to extract structured event data.
 */

import { type LineupEntry } from "@/services/lineup-types";
import { normalizeCountryName } from "@/utils/location-normalizer";

const DUTCH_MONTHS: Record<string, string> = {
  januari: "01", februari: "02", maart: "03", april: "04",
  mei: "05", juni: "06", juli: "07", augustus: "08",
  september: "09", oktober: "10", november: "11", december: "12",
};

const DUTCH_MONTH_NAMES = Object.keys(DUTCH_MONTHS).join("|");

/** Decode HTML numeric entities (&#123; and &#x1a;) and common named entities. */
function decodeHtmlEntities(text: string): string {
  const NAMED_ENTITIES: Record<string, string> = {
    amp: "&", lt: "<", gt: ">", quot: '"', apos: "'",
    nbsp: "\u00A0", ndash: "\u2013", mdash: "\u2014",
  };

  return text.replace(/&(?:#(\d+)|#x([0-9a-fA-F]+)|(\w+));/g, (match, dec, hex, named) => {
    if (dec) return String.fromCodePoint(parseInt(dec, 10));
    if (hex) return String.fromCodePoint(parseInt(hex, 16));
    if (named && NAMED_ENTITIES[named]) return NAMED_ENTITIES[named];
    return match;
  });
}

/** Parse a Dutch date string like "zaterdag 4 februari 2023 om 22:00" to YYYY-MM-DD. */
function parseDutchDate(dateStr: string): string | null {
  const match = dateStr.match(
    new RegExp(`(\\d{1,2})\\s+(${DUTCH_MONTH_NAMES})\\s+(\\d{4})`, "i")
  );
  if (!match) return null;

  const day = match[1].padStart(2, "0");
  const month = DUTCH_MONTHS[match[2].toLowerCase()];
  const year = match[3];
  if (!month) return null;

  return `${year}-${month}-${day}`;
}

export interface PFSearchResult {
  pfId: string;
  name: string;
  date: string | null;
  venue: string | null;
  location: string | null;
  imageUrl: string | null;
}

/** Parse the Partyflock search results page HTML. Filters for event ("feest") results only. */
export function parsePFSearchResults(html: string): PFSearchResult[] {
  const results: PFSearchResult[] = [];
  const resultBlockRegex = /<div class="hlbox res[^"]*">([\s\S]*?)<\/div>\s*<\/div>/g;
  let blockMatch;

  while ((blockMatch = resultBlockRegex.exec(html)) !== null) {
    const block = blockMatch[1];

    const typeMatch = block.match(/<div class="type">([^<]+)<\/div>/);
    if (!typeMatch || typeMatch[1].trim() !== "feest") continue;

    const linkMatch = block.match(/<a href="\/party\/(\d+):[^"]*">([^<]+)<\/a>/);
    if (!linkMatch) continue;

    const pfId = linkMatch[1];
    const name = linkMatch[2].trim();

    const dateMatch = block.match(/<div class="small"><div>([^<]+)<\/div>/);
    const date = dateMatch ? parseDutchDate(dateMatch[1]) : null;

    const venueMatch = block.match(/<a href="\/location\/[^"]*">([^<]+)<\/a>/);
    const venue = venueMatch ? venueMatch[1].trim() : null;

    const cityMatch = block.match(/<a href="\/city\/[^"]*">([^<]+)<\/a>/);
    const location = cityMatch ? cityMatch[1].trim() : null;

    const imageMatch = block.match(/data-lazy-style="background-image:\s*url\('([^']+)'\)"/);
    const imageUrl = imageMatch ? `https://partyflock.nl${imageMatch[1]}` : null;

    results.push({ pfId, name, date, venue, location, imageUrl });
  }

  return results;
}

export interface ParsedPFEvent {
  name: string | null;
  date: string | null;
  endDate: string | null;
  venue: string | null;
  location: string | null;
  imageUrl: string | null;
  lineup: LineupEntry[];
  latitude: number | null;
  longitude: number | null;
}

/**
 * Parse the Partyflock lineup table into groups of artist names per timeslot.
 *
 * Each timeslot starts with a `<div>` containing `class="light times"`.
 * B2B partners appear in subsequent `<div>` elements that either have
 * `class="invisible times"` or contain no time span at all — just the performer.
 *
 * Stage headers (`<th>`) break the grouping so artists from different stages
 * (including stages without timetables) are not merged into b2b sets.
 */
function parsePFTimeslotGroups(tableHtml: string): string[][] {
  const groups: string[][] = [];
  // Match both <th> (stage headers) and <div> (artist slots) sequentially
  const tokenRegex = /<th>[\s\S]*?<\/th>|<div>([\s\S]*?)<\/div>/g;
  let tokenMatch;
  let currentGroup: string[] = [];
  let isNoTimetableStage = false;

  while ((tokenMatch = tokenRegex.exec(tableHtml)) !== null) {
    const fullMatch = tokenMatch[0];

    // Stage header resets the current group
    if (fullMatch.startsWith("<th>")) {
      if (currentGroup.length > 0) {
        groups.push(currentGroup);
        currentGroup = [];
      }
      isNoTimetableStage = false;
      continue;
    }

    const divContent = tokenMatch[1];
    if (!divContent) continue;

    const nameMatch = divContent.match(/<span itemprop="name">([^<]+)<\/span>/);
    if (!nameMatch) continue;

    const artistName = decodeHtmlEntities(nameMatch[1].trim());
    const hasTimeslot = divContent.includes('class="light times"');

    // First artist in a stage without a timeslot means the entire stage
    // has no timetable — every artist is a separate solo act.
    if (currentGroup.length === 0 && !hasTimeslot) {
      isNoTimetableStage = true;
    }

    const startsNewGroup = hasTimeslot || isNoTimetableStage;

    if (startsNewGroup) {
      if (currentGroup.length > 0) {
        groups.push(currentGroup);
      }
      currentGroup = [artistName];
    } else {
      // No time span in a timetabled stage — b2b continuation
      currentGroup.push(artistName);
    }
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
}

/** Parse a partyflock.nl event detail page to extract structured data. */
export function parsePFEventPage(html: string): ParsedPFEvent {
  const h1Match = html.match(/<h1[^>]*itemprop="name"[^>]*>(?:<a[^>]*>)?([^<]+)/);
  const name = h1Match ? decodeHtmlEntities(h1Match[1].trim()) : null;

  const startDateMatch = html.match(/<time[^>]*itemprop="startDate"[^>]*datetime="([^"]+)"/);
  let date: string | null = null;
  if (startDateMatch) {
    const parsed = new Date(startDateMatch[1]);
    if (!isNaN(parsed.getTime())) {
      date = parsed.toLocaleDateString("en-CA", { timeZone: "Europe/Amsterdam" });
    }
  }

  const endDate: string | null = null;

  const venueMatch = html.match(
    /<span[^>]*itemprop="location"[^>]*>[\s\S]*?<span itemprop="name">([^<]+)<\/span>/
  );
  const venue = venueMatch ? venueMatch[1].trim() : null;

  const cityMatch = html.match(/<span itemprop="addressLocality">[\s\S]*?<a[^>]*>([^<]+)<\/a>/);
  const countryMatch = html.match(/<span itemprop="addressCountry">[\s\S]*?<a[^>]*>([^<]+)<\/a>/);
  const city = cityMatch ? cityMatch[1].trim() : null;
  const rawCountry = countryMatch ? countryMatch[1].trim() : null;
  const country = rawCountry ? normalizeCountryName(rawCountry) : null;

  let location: string | null = null;
  if (city && country) {
    location = `${city}, ${country}`;
  } else if (city) {
    location = city;
  }

  const ogImageMatch = html.match(
    /<meta\s+(?:property="og:image"\s+content="([^"]+)"|content="([^"]+)"\s+property="og:image")/
  );
  const imageUrl = ogImageMatch ? (ogImageMatch[1] ?? ogImageMatch[2]) : null;

  const latMatch = html.match(/<meta itemprop="latitude"\s+content="([^"]+)"/);
  const lngMatch = html.match(/<meta itemprop="longitude"\s+content="([^"]+)"/);
  const latitude = latMatch ? parseFloat(latMatch[1]) || null : null;
  const longitude = lngMatch ? parseFloat(lngMatch[1]) || null : null;

  const lineup: LineupEntry[] = [];
  const seenEntries = new Set<string>();
  const lineupSection = html.match(/<table class="lineup[^"]*">([\s\S]*?)<\/table>/);

  if (lineupSection) {
    const timeslotGroups = parsePFTimeslotGroups(lineupSection[1]);
    for (const group of timeslotGroups) {
      if (group.length === 0) continue;

      const dedupeKey = group.join(" | ");
      if (seenEntries.has(dedupeKey)) continue;
      seenEntries.add(dedupeKey);

      if (group.length === 1) {
        lineup.push({ type: "solo", name: group[0] });
      } else {
        const originalName = group.join(" & ");
        lineup.push({ type: "b2b", originalName, members: group });
      }
    }
  }

  return { name, date, endDate, venue, location, imageUrl, lineup, latitude, longitude };
}
