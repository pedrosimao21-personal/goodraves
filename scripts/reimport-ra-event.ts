/**
 * Reimport a single RA event — clears existing lineup and re-fetches from RA GraphQL.
 *
 * Usage:
 *   npx tsx scripts/reimport-ra-event.ts 1851830
 *   npx tsx scripts/reimport-ra-event.ts ra-1851830
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

/**
 * Parse RA's `lineup` text field which contains both linked artists
 * (wrapped in `<artist id="...">Name</artist>`) and plain-text artist names.
 */
function parseRALineup(lineupText: string | null | undefined, fallbackArtists?: string[]): string[] {
  if (!lineupText) return fallbackArtists ?? [];
  const names: string[] = [];
  for (const rawLine of lineupText.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const cleaned = line.replace(/<artist[^>]*>(.*?)<\/artist>/g, "$1").trim();
    if (!cleaned) continue;
    if (/^hosted by/i.test(cleaned)) continue;
    names.push(cleaned);
  }
  return [...new Set(names)];
}
import { eq, inArray } from "drizzle-orm";
import { festivals, festivalArtists, artists } from "../src/db/schema";

async function ensureArtistsAndGetIds(
  db: ReturnType<typeof drizzle>,
  names: string[]
): Promise<Record<string, string>> {
  if (names.length === 0) return {};

  await db
    .insert(artists)
    .values(names.map((name) => ({ name })))
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
  const rawId = process.argv[2];
  if (!rawId) {
    console.error("Usage: npx tsx scripts/reimport-ra-event.ts <ra-event-id>");
    process.exit(1);
  }

  const id = rawId.replace(/\D/g, "");
  if (!id) {
    console.error("Invalid event ID:", rawId);
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required.");
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);
  const db = drizzle(sql);
  const festivalId = `ra-${id}`;

  console.log(`Reimporting ${festivalId}...`);

  // 1. Delete existing lineup
  await db
    .delete(festivalArtists)
    .where(eq(festivalArtists.festivalId, festivalId));
  console.log("Cleared existing lineup.");

  // 2. Fetch from RA GraphQL
  const query = `
    query GET_EVENT($id: ID!) {
      event(id: $id) {
        id
        title
        startTime
        endTime
        venue {
          name
          area {
            name
            country { name }
          }
        }
        images { filename }
        artists {
          name
        }
        lineup
      }
    }
  `;

  const res = await fetch("https://ra.co/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0",
      Referer: `https://ra.co/events/${id}`,
    },
    body: JSON.stringify({ query, variables: { id } }),
  });

  if (!res.ok) {
    console.error(`RA API returned ${res.status}`);
    process.exit(1);
  }

  const json = await res.json();
  const data = json?.data?.event;

  if (!data) {
    console.error("No event data returned from RA.", JSON.stringify(json?.errors ?? json, null, 2));
    process.exit(1);
  }

  console.log(`Event: ${data.title}`);

  // Parse full lineup from text field, falling back to linked artists array
  const artistsFallback = (data.artists ?? [])
    .map((a: any) => a?.name)
    .filter(Boolean) as string[];
  const lineup = parseRALineup(data.lineup, artistsFallback);

  console.log(`Lineup (${lineup.length} artists):`, lineup);

  // 3. Upsert festival metadata
  const date = data.startTime
    ? new Date(data.startTime).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  const endDate = data.endTime
    ? new Date(data.endTime).toISOString().slice(0, 10)
    : null;
  const venueName = data.venue?.name ?? null;
  const areaName = data.venue?.area?.name ?? null;
  const countryName = data.venue?.area?.country?.name ?? null;
  const location = [areaName, countryName].filter(Boolean).join(", ") || null;
  const imageUrl = data.images?.[0]?.filename ?? null;

  await db
    .insert(festivals)
    .values({
      id: festivalId,
      name: data.title ?? `RA Event ${id}`,
      date,
      endDate,
      venue: venueName,
      location,
      source: "ra",
      sourceId: id,
      imageUrl,
    })
    .onConflictDoNothing();

  // 4. Save lineup
  if (lineup.length > 0) {
    const nameToId = await ensureArtistsAndGetIds(db, lineup);
    const values = lineup
      .filter((name) => nameToId[name])
      .map((name) => ({ festivalId, artistId: nameToId[name] }));

    if (values.length > 0) {
      await db.insert(festivalArtists).values(values).onConflictDoNothing();
      console.log(`Saved ${values.length} artists to lineup.`);
    }
  } else {
    console.warn("No artists found in RA response.");
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
