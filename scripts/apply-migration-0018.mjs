/**
 * Applies migration 0018_typical_sir_ram using the neon-http driver
 * (same transport the app uses), then records it in __drizzle_migrations.
 */
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

const MIGRATION_TAG = "0018_typical_sir_ram";
const MIGRATION_HASH = "0018_typical_sir_ram";

async function alreadyApplied() {
  try {
    const rows = await sql.query(
      `SELECT hash FROM __drizzle_migrations WHERE hash = $1 LIMIT 1`,
      [MIGRATION_HASH]
    );
    return rows.length > 0;
  } catch {
    return false;
  }
}

async function run() {
  if (await alreadyApplied()) {
    console.log(`Migration ${MIGRATION_TAG} already applied. Nothing to do.`);
    return;
  }

  const sqlPath = join(__dirname, "../drizzle/0018_typical_sir_ram.sql");
  const migrationSql = readFileSync(sqlPath, "utf-8");

  // Split on Drizzle's statement-breakpoint marker
  const statements = migrationSql
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);

  console.log(`Applying ${statements.length} statement(s) from ${MIGRATION_TAG}...`);

  for (const statement of statements) {
    console.log(`  → ${statement.slice(0, 80).replace(/\n/g, " ")}...`);
    await sql.query(statement);
  }

  await sql.query(
    `INSERT INTO __drizzle_migrations (hash, created_at) VALUES ($1, $2)`,
    [MIGRATION_HASH, Date.now()]
  );

  console.log(`Migration ${MIGRATION_TAG} applied successfully.`);
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
