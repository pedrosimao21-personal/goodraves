import { db } from "@/db";
import { sql } from "drizzle-orm";

/**
 * Database-backed rate limiter that works correctly in serverless environments.
 * Uses a simple SQL query to count recent attempts by identifier (e.g. IP).
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
  const windowStart = new Date(Date.now() - windowMs);

  // Count recent attempts and insert new one in a single round-trip.
  // Cleanup is scoped to the current identifier+action pair to avoid
  // global table scans on every rate-limit check.
  const result = await db.execute(
    sql`
      WITH cleanup AS (
        DELETE FROM rate_limit_attempts
        WHERE identifier = ${identifier}
          AND action = ${action}
          AND created_at < ${windowStart}
      ),
      recent AS (
        SELECT COUNT(*) AS cnt
        FROM rate_limit_attempts
        WHERE identifier = ${identifier}
          AND action = ${action}
          AND created_at >= ${windowStart}
      ),
      ins AS (
        INSERT INTO rate_limit_attempts (identifier, action)
        VALUES (${identifier}, ${action})
      )
      SELECT cnt FROM recent
    `
  );

  const rows = result.rows as Array<{ cnt: string }>;
  const count = parseInt(String(rows[0]?.cnt ?? "0"), 10);
  return count >= maxAttempts;
}
