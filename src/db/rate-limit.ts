import { db } from "@/db";
import { sql } from "drizzle-orm";
import { RATE_LIMIT_RETENTION_HOURS } from "@/lib/constants";

/**
 * Database-backed rate limiter that works correctly in serverless environments.
 *
 * Fixed-window counter: one row per (identifier, action, window bucket),
 * incremented by a single `INSERT ... ON CONFLICT DO UPDATE` statement.
 * Postgres takes a row-level lock on the conflicting row for the statement's
 * duration, so concurrent callers for the same key are serialized against
 * each other rather than each reading a stale pre-insert count — a plain
 * "SELECT count, then INSERT" (the previous approach) lets every request in a
 * burst see the same count and all pass, since nothing blocks the read. The
 * trade-off is the standard fixed-window one: a burst spanning a bucket
 * boundary can reach ~2x maxAttempts. Acceptable in exchange for the count
 * actually holding under concurrency.
 */

/**
 * Check if an identifier has exceeded the rate limit.
 * Also records the current attempt.
 *
 * @returns true if the request should be BLOCKED
 */
export async function isRateLimited(
  identifier: string,
  action: string,
  maxAttempts: number,
  windowMs: number
): Promise<boolean> {
  // Bucket boundary in ms since epoch, as a real Date so it matches
  // window_start's timestamptz type exactly on both the insert and the
  // (separate, best-effort) cleanup below.
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);

  const result = await db.execute(
    sql`
      INSERT INTO rate_limit_counters (identifier, action, window_start, count)
      VALUES (${identifier}, ${action}, ${windowStart}, 1)
      ON CONFLICT (identifier, action, window_start)
      DO UPDATE SET count = rate_limit_counters.count + 1
      RETURNING count
    `
  );

  const rows = result.rows as Array<{ count: number }>;
  const count = Number(rows[0]?.count ?? 1);

  // Best-effort cleanup of old buckets for this identifier+action, so the
  // table doesn't grow unbounded. Scoped to the current key (cheap index
  // lookup, not a table scan) and safe to skip on failure — it never gates
  // the rate-limit decision itself.
  db.execute(
    sql`
      DELETE FROM rate_limit_counters
      WHERE identifier = ${identifier} AND action = ${action} AND window_start < ${windowStart}
    `
  ).catch(() => {});

  return count > maxAttempts;
}

/**
 * Delete every bucket older than RATE_LIMIT_RETENTION_HOURS. The per-key
 * cleanup above only runs when the same caller comes back, so without this an
 * IP that visits once keeps its row forever — and those rows hold IP
 * addresses, which the privacy policy promises are kept only briefly. Run by
 * the daily-maintenance cron. Returns the number of rows removed.
 */
export async function pruneRateLimitCounters(): Promise<number> {
  const cutoff = new Date(Date.now() - RATE_LIMIT_RETENTION_HOURS * 60 * 60 * 1000);
  const result = await db.execute(sql`DELETE FROM rate_limit_counters WHERE window_start < ${cutoff}`);
  return result.rowCount ?? 0;
}
