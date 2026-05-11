/**
 * Parse festivalfans.nl event page HTML to extract structured data.
 */

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
  lineup: string[];
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
  const lineup: string[] = [];
  const contentMatch = html.match(/<div class="event-text">([\s\S]*)/);
  const contentHtml = contentMatch ? contentMatch[1] : html;
  const currentYearHtml = contentHtml.split(/<div class="trigger">/)[0] ?? contentHtml;

  const seenNames = new Set<string>();
  const linkRegex = /<a\s+href="https?:\/\/festivalfans\.nl\/artiest\/[^"]*"\s+title="([^"]+)"/g;
  let artistMatch;
  while ((artistMatch = linkRegex.exec(currentYearHtml)) !== null) {
    const artistName = artistMatch[1].trim();
    if (!seenNames.has(artistName)) {
      seenNames.add(artistName);
      lineup.push(artistName);
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
