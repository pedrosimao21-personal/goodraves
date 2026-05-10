/**
 * Reimport a single FestivalFans.nl event — clears existing lineup and re-fetches from the website.
 *
 * Usage:
 *   npx tsx scripts/reimport-ff-event.ts blijdorp-festival
 *   npx tsx scripts/reimport-ff-event.ts ff-blijdorp-festival
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, inArray } from "drizzle-orm";
import { festivals, festivalArtists, artists } from "../src/db/schema";

const DUTCH_MONTHS: Record<string, string> = {
  januari: "01", februari: "02", maart: "03", april: "04",
  mei: "05", juni: "06", juli: "07", augustus: "08",
  september: "09", oktober: "10", november: "11", december: "12",
};

function parseDutchDate(dateStr: string): string | null {
  const match = dateStr.match(
    /(\d{1,2})\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+(\d{4})/i
  );
  if (!match) return null;
  const day = match[1].padStart(2, "0");
  const month = DUTCH_MONTHS[match[2].toLowerCase()];
  if (!month) return null;
  return `${match[3]}-${month}-${day}`;
}

function parseFFEventPage(html: string): {
  name: string | null;
  date: string | null;
  endDate: string | null;
  venue: string | null;
  location: string | null;
  imageUrl: string | null;
  lineup: string[];
  latitude: number | null;
  longitude: number | null;
} {
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
  const name = h1Match ? h1Match[1].trim() : null;

  const getTableField = (label: string): string | null => {
    const re = new RegExp(
      `<td[^>]*class="td-${label}"[^>]*>[^<]*</td>\\s*<td[^>]*>(.*?)</td>`,
      "is"
    );
    const m = html.match(re);
    if (!m) return null;
    return m[1].replace(/<[^>]+>/g, "").trim() || null;
  };

  const dateStr = getTableField("datum");
  let date: string | null = dateStr ? parseDutchDate(dateStr) : null;
  let endDate: string | null = null;

  const ldJsonMatch = html.match(
    /<script type="application\/ld\+json"[^>]*>\s*(\{[^]*?"@type"\s*:\s*"Event"[^]*?\})\s*<\/script>/
  );
  if (ldJsonMatch) {
    try {
      const ld = JSON.parse(ldJsonMatch[1]);
      if (ld.startDate) {
        date = new Date(ld.startDate).toISOString().slice(0, 10);
      }
      if (ld.endDate && ld.endDate !== ld.startDate) {
        endDate = new Date(ld.endDate).toISOString().slice(0, 10);
      }
    } catch { /* ignore malformed JSON-LD */ }
  }

  const venue = getTableField("locatie");
  const cityRaw = getTableField("stad");
  const location = cityRaw ? `${cityRaw}, Netherlands` : null;

  const ogImageMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/);
  const imageUrl = ogImageMatch ? ogImageMatch[1] : null;

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

  let latitude: number | null = null;
  let longitude: number | null = null;
  if (ldJsonMatch) {
    try {
      const ld = JSON.parse(ldJsonMatch[1]);
      if (ld.location?.geo) {
        latitude = parseFloat(ld.location.geo.latitude) || null;
        longitude = parseFloat(ld.location.geo.longitude) || null;
      }
    } catch { /* ignore */ }
  }

  return { name, date, endDate, venue, location, imageUrl, lineup, latitude, longitude };
}

async function ensureArtistsAndGetIds(
  db: ReturnType<typeof drizzle>,
  names: string[]
): Promise<Record<string, string>> {
  if (names.length === 0) return {};

  await db
    .insert(artists)
    .values(names.map((artistName) => ({ name: artistName })))
    .onConflictDoNothing();

  const rows = await db
    .select({ id: artists.id, name: artists.name })
    .from(artists)
    .where(inArray(artists.name, names));

  const map: Record<string, string> = {};
  for (const r of rows) map[r.name] = r.id;
  return map;
}

async function main() {
  const rawSlug = process.argv[2];
  if (!rawSlug) {
    console.error("Usage: npx tsx scripts/reimport-ff-event.ts <slug>");
    process.exit(1);
  }

  const slug = rawSlug.replace(/^ff-/, "");
  if (!slug || !/^[a-z0-9-]+$/i.test(slug)) {
    console.error("Invalid slug:", rawSlug);
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required.");
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);
  const db = drizzle(sql);
  const festivalId = `ff-${slug}`;

  console.log(`Reimporting ${festivalId}...`);

  // 1. Delete existing lineup
  await db
    .delete(festivalArtists)
    .where(eq(festivalArtists.festivalId, festivalId));
  console.log("Cleared existing lineup.");

  // 2. Fetch from FestivalFans.nl
  const res = await fetch(`https://festivalfans.nl/event/${slug}/`, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      Accept: "text/html",
    },
  });

  if (!res.ok) {
    console.error(`FestivalFans returned ${res.status}`);
    process.exit(1);
  }

  const html = await res.text();
  const parsed = parseFFEventPage(html);

  if (!parsed.name) {
    console.error("Could not parse event name from page.");
    process.exit(1);
  }

  console.log(`Event: ${parsed.name}`);
  console.log(`Lineup (${parsed.lineup.length} artists):`, parsed.lineup);

  // 3. Upsert festival metadata
  const date = parsed.date ?? new Date().toISOString().slice(0, 10);

  await db
    .insert(festivals)
    .values({
      id: festivalId,
      name: parsed.name,
      date,
      endDate: parsed.endDate,
      venue: parsed.venue,
      location: parsed.location,
      source: "festivalfans",
      sourceId: slug,
      imageUrl: parsed.imageUrl,
      latitude: parsed.latitude,
      longitude: parsed.longitude,
    })
    .onConflictDoUpdate({
      target: festivals.id,
      set: {
        name: parsed.name,
        date,
        endDate: parsed.endDate,
        venue: parsed.venue,
        location: parsed.location,
        imageUrl: parsed.imageUrl,
        latitude: parsed.latitude,
        longitude: parsed.longitude,
      },
    });

  // 4. Save lineup
  if (parsed.lineup.length > 0) {
    const nameToId = await ensureArtistsAndGetIds(db, parsed.lineup);
    const values = parsed.lineup
      .filter((artistName) => nameToId[artistName])
      .map((artistName) => ({ festivalId, artistId: nameToId[artistName] }));

    if (values.length > 0) {
      await db.insert(festivalArtists).values(values).onConflictDoNothing();
      console.log(`Saved ${values.length} artists to lineup.`);
    }
  } else {
    console.warn("No artists found on FestivalFans page.");
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
