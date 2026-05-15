/**
 * Parse festivalfans.nl event page HTML to extract structured data.
 */

import { type LineupEntry, B2B_CONNECTOR_PATTERN } from "@/services/lineup-types";

const DUTCH_MONTHS: Record<string, string> = {
  januari: "01", februari: "02", maart: "03", april: "04",
  mei: "05", juni: "06", juli: "07", augustus: "08",
  september: "09", oktober: "10", november: "11", december: "12",
};

const DUTCH_MONTH_NAMES = Object.keys(DUTCH_MONTHS).join("|");

/**
 * Parse a Dutch date string like "Donderdag 1 januari 2026" to YYYY-MM-DD.
 */
export function parseDutchDate(dateStr: string): string | null {
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

export interface ParsedFFEvent {
  name: string | null;
  date: string | null;
  endDate: string | null;
  venue: string | null;
  location: string | null;
  time: string | null;
  imageUrl: string | null;
  lineup: LineupEntry[];
  latitude: number | null;
  longitude: number | null;
}

/** Extract a table field value from festivalfans.nl HTML by label class */
function extractTableField(html: string, label: string): string | null {
  const re = new RegExp(
    `<td[^>]*class="td-${label}"[^>]*>[^<]*</td>\\s*<td[^>]*>(.*?)</td>`,
    "is"
  );
  const match = html.match(re);
  if (!match) return null;
  return match[1].replace(/<[^>]+>/g, "").trim() || null;
}

/** Extract dates from JSON-LD schema.org markup */
function extractSchemaOrgDates(html: string): { date: string | null; endDate: string | null } {
  const ldJsonMatch = html.match(
    /<script type="application\/ld\+json"[^>]*>\s*(\{[^]*?"@type"\s*:\s*"Event"[^]*?\})\s*<\/script>/
  );
  if (!ldJsonMatch) return { date: null, endDate: null };

  try {
    const ld = JSON.parse(ldJsonMatch[1]);
    const date = ld.startDate
      ? new Date(ld.startDate)
          .toLocaleDateString("en-CA", { timeZone: "Europe/Amsterdam" })
      : null;
    const endDate = ld.endDate && ld.endDate !== ld.startDate
      ? new Date(ld.endDate)
          .toLocaleDateString("en-CA", { timeZone: "Europe/Amsterdam" })
      : null;
    return { date, endDate };
  } catch {
    return { date: null, endDate: null };
  }
}

/** Extract lat/lng from JSON-LD schema.org markup */
function extractSchemaOrgGeo(html: string): { latitude: number | null; longitude: number | null } {
  const ldJsonMatch = html.match(
    /<script type="application\/ld\+json"[^>]*>\s*(\{[^]*?"@type"\s*:\s*"Event"[^]*?\})\s*<\/script>/
  );
  if (!ldJsonMatch) return { latitude: null, longitude: null };

  try {
    const ld = JSON.parse(ldJsonMatch[1]);
    if (!ld.location?.geo) return { latitude: null, longitude: null };
    return {
      latitude: parseFloat(ld.location.geo.latitude) || null,
      longitude: parseFloat(ld.location.geo.longitude) || null,
    };
  } catch {
    return { latitude: null, longitude: null };
  }
}

/** Extract artist name from a FestivalFans artist link tag. */
function extractArtistFromLink(tag: string): string | null {
  const match = tag.match(/title="([^"]+)"/);
  return match ? match[1].trim() : null;
}

/**
 * Parse a single lineup line from FestivalFans HTML.
 * A line is the content between `<br>` tags, typically formatted as:
 *   `12:00 – 14:00 <a href="/artiest/a" title="A">A</a> x <a href="/artiest/b" title="B">B</a>`
 *
 * Returns null if the line contains no artist links.
 */
function parseFFLineupLine(line: string): LineupEntry | null {
  const linkPattern = /<a\s+href="https?:\/\/festivalfans\.nl\/artiest\/[^"]*"[^>]*>.*?<\/a>/gi;
  const links = line.match(linkPattern);
  if (!links || links.length === 0) return null;

  if (links.length === 1) {
    const name = extractArtistFromLink(links[0]);
    if (!name) return null;
    return { type: "solo", name };
  }

  // Check connectors between each pair of consecutive links
  const artistNames: string[] = [];
  let isB2b = true;

  for (let i = 0; i < links.length; i++) {
    const name = extractArtistFromLink(links[i]);
    if (!name) continue;
    artistNames.push(name);

    if (i < links.length - 1) {
      const currentEnd = line.indexOf(links[i]) + links[i].length;
      const nextStart = line.indexOf(links[i + 1], currentEnd);
      const textBetween = line.slice(currentEnd, nextStart).replace(/<[^>]+>/g, "");

      if (!B2B_CONNECTOR_PATTERN.test(textBetween)) {
        isB2b = false;
      }
    }
  }

  if (artistNames.length < 2) {
    return artistNames.length === 1
      ? { type: "solo", name: artistNames[0] }
      : null;
  }

  if (!isB2b) {
    // Non-b2b multi-artist line (e.g. comma-separated collective).
    // Return null so individual artists are not grouped as b2b.
    // Each artist will be picked up by the fallback solo extraction below.
    return null;
  }

  const originalName = rebuildOriginalName(line, links, artistNames);
  return { type: "b2b", originalName, members: artistNames };
}

/**
 * Rebuild the display name from the line HTML, preserving original connectors
 * and any trailing suffixes (e.g. "Live", "House Set").
 */
function rebuildOriginalName(
  line: string,
  links: string[],
  artistNames: string[]
): string {
  const parts: string[] = [];
  for (let i = 0; i < links.length; i++) {
    parts.push(artistNames[i]);
    if (i < links.length - 1) {
      const currentEnd = line.indexOf(links[i]) + links[i].length;
      const nextStart = line.indexOf(links[i + 1], currentEnd);
      const connector = line.slice(currentEnd, nextStart).replace(/<[^>]+>/g, "").trim();
      parts.push(` ${connector} `);
    }
  }

  // Capture trailing text after the last link (e.g. " House Set")
  const lastLinkEnd = line.lastIndexOf(links[links.length - 1]) + links[links.length - 1].length;
  const trailingText = line.slice(lastLinkEnd).replace(/<[^>]+>/g, "").trim();
  if (trailingText) {
    parts.push(` ${trailingText}`);
  }

  return parts.join("").trim();
}

/**
 * Parse festivalfans.nl event page HTML to extract structured data.
 */
export function parseFFEventPage(html: string): ParsedFFEvent {
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
  const name = h1Match ? h1Match[1].trim() : null;

  const dateStr = extractTableField(html, "datum");
  let date: string | null = dateStr ? parseDutchDate(dateStr) : null;

  const schemaOrgDates = extractSchemaOrgDates(html);
  if (schemaOrgDates.date) date = schemaOrgDates.date;
  const endDate = schemaOrgDates.endDate;

  const venue = extractTableField(html, "locatie");
  const cityRaw = extractTableField(html, "stad");
  const location = cityRaw ? `${cityRaw}, Netherlands` : null;
  const time = extractTableField(html, "tijd");

  const ogImageMatch = html.match(
    /<meta\s+(?:property="og:image"\s+content="([^"]+)"|content="([^"]+)"\s+property="og:image")/
  );
  const imageUrl = ogImageMatch ? (ogImageMatch[1] ?? ogImageMatch[2]) : null;

  // Extract lineup from artist links in the event content area
  const lineup: LineupEntry[] = [];
  const contentMatch = html.match(/<div class="event-text">([\s\S]*)/);
  const contentHtml = contentMatch ? contentMatch[1] : html;
  const currentYearHtml = contentHtml.split(/<div class="trigger">/)[0] ?? contentHtml;

  const seenEntries = new Set<string>();
  const lines = currentYearHtml.split(/<br\s*\/?>/i);

  for (const line of lines) {
    const entry = parseFFLineupLine(line);
    if (entry) {
      const dedupeKey = entry.type === "solo"
        ? entry.name
        : entry.members.join(" | ");
      if (!seenEntries.has(dedupeKey)) {
        seenEntries.add(dedupeKey);
        lineup.push(entry);
      }
      continue;
    }

    // Fallback: extract individual artist links as solo entries
    // (handles comma-separated collectives and other non-b2b multi-artist lines)
    const fallbackLinkRegex = /<a\s+href="https?:\/\/festivalfans\.nl\/artiest\/[^"]*"\s+title="([^"]+)"/g;
    let fallbackMatch;
    while ((fallbackMatch = fallbackLinkRegex.exec(line)) !== null) {
      const artistName = fallbackMatch[1].trim();
      if (!seenEntries.has(artistName)) {
        seenEntries.add(artistName);
        lineup.push({ type: "solo", name: artistName });
      }
    }
  }

  const { latitude, longitude } = extractSchemaOrgGeo(html);

  return { name, date, endDate, venue, location, time, imageUrl, lineup, latitude, longitude };
}

/** Extract festival slug from a festivalfans.nl URL. */
function extractFFSlugInternal(input: string): string | null {
  const match = input.match(/festivalfans\.nl\/event\/([a-z0-9-]+)/i);
  return match ? match[1] : null;
}

/** Async wrapper for use in client components. */
export async function extractFFSlug(input: string): Promise<string | null> {
  return extractFFSlugInternal(input);
}
