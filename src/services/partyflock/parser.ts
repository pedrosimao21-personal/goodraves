/**
 * Parse partyflock.nl HTML pages to extract structured event data.
 */

const DUTCH_MONTHS: Record<string, string> = {
  januari: "01", februari: "02", maart: "03", april: "04",
  mei: "05", juni: "06", juli: "07", augustus: "08",
  september: "09", oktober: "10", november: "11", december: "12",
};

const DUTCH_MONTH_NAMES = Object.keys(DUTCH_MONTHS).join("|");

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
  lineup: string[];
  latitude: number | null;
  longitude: number | null;
}

/** Parse a partyflock.nl event detail page to extract structured data. */
export function parsePFEventPage(html: string): ParsedPFEvent {
  const h1Match = html.match(/<h1[^>]*itemprop="name"[^>]*>(?:<a[^>]*>)?([^<]+)/);
  const name = h1Match ? h1Match[1].trim() : null;

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
  const country = countryMatch ? countryMatch[1].trim() : null;

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

  const lineup: string[] = [];
  const seenNames = new Set<string>();
  const artistRegex = /<span itemprop="name">([^<]+)<\/span>/g;

  const lineupSection = html.match(/<table class="lineup[^"]*">([\s\S]*?)<\/table>/);
  if (lineupSection) {
    let artistMatch;
    while ((artistMatch = artistRegex.exec(lineupSection[1])) !== null) {
      const artistName = artistMatch[1].trim();
      if (!seenNames.has(artistName)) {
        seenNames.add(artistName);
        lineup.push(artistName);
      }
    }
  }

  return { name, date, endDate, venue, location, imageUrl, lineup, latitude, longitude };
}
