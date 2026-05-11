/**
 * Standalone migration script — runs 0012_profile_and_related_artists.sql
 * directly against the database using the existing Neon connection.
 *
 * Usage: node scripts/migrate-0012.mjs
 */
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { join, dirname } from "path";
import { config } from "dotenv";

config({ path: ".env.local" });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set in .env.local");
  process.exit(1);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const sqlPath = join(__dirname, "../drizzle/0012_profile_and_related_artists.sql");
const sql = readFileSync(sqlPath, "utf8");

const db = neon(DATABASE_URL);

// Split on semicolons and run each statement
const statements = sql
  .split(";")
  .map((s) => s.trim())
  .filter((s) => s.length > 0 && !s.startsWith("--"));

console.log(`Running ${statements.length} SQL statement(s)...`);

for (const statement of statements) {
  try {
    await db(statement);
    console.log("OK:", statement.substring(0, 60).replace(/\n/g, " ") + "...");
  } catch (err) {
    // Ignore "already exists" errors — migration is idempotent
    if (err.message?.includes("already exists")) {
      console.log("SKIP (already exists):", statement.substring(0, 60).replace(/\n/g, " "));
    } else {
      console.error("FAILED:", statement);
      console.error(err.message);
    }
  }
}

console.log("Migration complete.");
