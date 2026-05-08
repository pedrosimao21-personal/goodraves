/**
 * Seed script — inserts RA events from scripts/data-ra-events.js into Neon Postgres.
 *
 * Usage:
 *   DATABASE_URL="postgres://..." npx tsx scripts/seed-db.ts
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { festivals, festivalArtists } from "../src/db/schema";

// Dynamic import of the JS data file
async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required. Pass it as an env variable.");
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);
  const db = drizzle(sql);

  // Import the RA events object
  const mod = await import("./data-ra-events.js");
  const RA_STATIC_EVENTS: Record<
    string,
    {
      id: string;
      name: string;
      date: string;
      venue: { name: string; city: string };
      lineup: string[];
      link: string;
      source: string;
    }
  > = mod.default ?? (mod as any).RA_STATIC_EVENTS ?? mod;

  const events = Object.values(RA_STATIC_EVENTS);
  console.log(`Seeding ${events.length} festivals...`);

  // Batch insert festivals (chunks of 50 to stay within query limits)
  const CHUNK = 50;
  for (let i = 0; i < events.length; i += CHUNK) {
    const chunk = events.slice(i, i + CHUNK);

    await db
      .insert(festivals)
      .values(
        chunk.map((e) => ({
          id: e.id,
          name: e.name,
          date: e.date,
          venue: e.venue?.name ?? null,
          location: e.venue?.city ?? null,
          source: e.source,
          sourceId: e.id.replace("ra-", ""),
        }))
      )
      .onConflictDoNothing();

    // Insert lineup entries
    const lineupRows = chunk.flatMap((e) =>
      (e.lineup ?? []).map((artist: string) => ({
        festivalId: e.id,
        artistName: artist,
      }))
    );

    if (lineupRows.length > 0) {
      await db.insert(festivalArtists).values(lineupRows).onConflictDoNothing();
    }

    console.log(`  inserted ${Math.min(i + CHUNK, events.length)} / ${events.length}`);
  }

  console.log("Done!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
