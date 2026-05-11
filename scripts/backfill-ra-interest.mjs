/**
 * One-time backfill script — fetches interestedCount + attending from RA GraphQL
 * for all existing RA festivals in the DB and updates the interested_count column.
 *
 * Uses exponential backoff on rate limits.
 * Skips festivals that already have interested_count > 0 to avoid duplicate work.
 *
 * Usage: node scripts/backfill-ra-interest.mjs
 */
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set in .env.local");
  process.exit(1);
}

const db = neon(DATABASE_URL);

const RA_GRAPHQL_URL = "https://ra.co/graphql";
const BATCH_SIZE = 10;
const BASE_DELAY_MS = 500;
const MAX_DELAY_MS = 5000;
const MAX_RETRIES = 4;

const GET_EVENT_INTEREST_QUERY = `
  query GET_EVENT_INTEREST($id: ID!) {
    event(id: $id) {
      id
      interestedCount
      attending
    }
  }
`;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch interestedCount + attending for a single RA event with exponential backoff.
 */
async function fetchRaInterest(raId, attempt = 0) {
  try {
    const res = await fetch(RA_GRAPHQL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0",
        Referer: `https://ra.co/events/${raId}`,
      },
      body: JSON.stringify({
        query: GET_EVENT_INTEREST_QUERY,
        variables: { id: raId },
      }),
    });

    if (res.status === 429) {
      if (attempt >= MAX_RETRIES) {
        console.warn(`  [${raId}] Rate limited after ${MAX_RETRIES} retries, skipping`);
        return null;
      }
      const delayMs = Math.min(BASE_DELAY_MS * 2 ** attempt, MAX_DELAY_MS);
      console.warn(`  [${raId}] Rate limited — retrying in ${delayMs}ms (attempt ${attempt + 1})`);
      await sleep(delayMs);
      return fetchRaInterest(raId, attempt + 1);
    }

    if (!res.ok) {
      console.warn(`  [${raId}] RA returned ${res.status}, skipping`);
      return null;
    }

    const json = await res.json();
    const event = json?.data?.event;
    if (!event) return null;

    return (event.interestedCount ?? 0) + (event.attending ?? 0);
  } catch (err) {
    console.warn(`  [${raId}] Fetch error: ${err.message}, skipping`);
    return null;
  }
}

async function main() {
  console.log("Fetching RA festivals from DB...");

  // Only fetch festivals that haven't been backfilled yet (interested_count = 0 or null)
  const rows = await db(
    `SELECT id, source_id FROM festivals
     WHERE source = 'ra'
       AND source_id IS NOT NULL
       AND (interested_count IS NULL OR interested_count = 0)
     ORDER BY date DESC`
  );

  console.log(`Found ${rows.length} RA festivals to backfill`);

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    console.log(`\nBatch ${Math.floor(i / BATCH_SIZE) + 1} / ${Math.ceil(rows.length / BATCH_SIZE)}`);

    for (const row of batch) {
      const festivalId = row.id;
      const raId = row.source_id;

      process.stdout.write(`  [${festivalId}] Fetching RA #${raId}...`);

      const total = await fetchRaInterest(raId);

      if (total === null) {
        process.stdout.write(" SKIP\n");
        skipped++;
        continue;
      }

      if (total === 0) {
        process.stdout.write(" 0 (no interest data)\n");
        skipped++;
        continue;
      }

      await db(
        `UPDATE festivals SET interested_count = $1 WHERE id = $2`,
        [total, festivalId]
      );
      process.stdout.write(` ${total} interested — UPDATED\n`);
      updated++;

      // Polite delay between requests
      await sleep(BASE_DELAY_MS);
    }
  }

  console.log(`\n--- Backfill complete ---`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped (no data): ${skipped}`);
  console.log(`Failed: ${failed}`);
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
