-- Two launch-readiness fixes:
--
-- 1. rate_limit_attempts (identifier, action, created_at log rows, counted via
--    a sliding-window SELECT) lets a burst of concurrent requests all read the
--    same pre-insert count and all pass: the count-check and the insert are
--    separate statements with no shared lock, so N parallel callers can each
--    see cnt=0 and each be allowed through. rate_limit_counters replaces it
--    with one row per (identifier, action, window_start) and an atomic
--    `INSERT ... ON CONFLICT DO UPDATE SET count = count + 1`, which Postgres
--    serializes at the row level — concurrent callers for the same key queue
--    on the same row instead of racing a read. This is a fixed window
--    (buckets of RATE_LIMIT_WINDOW_MS) rather than the old sliding window; the
--    standard fixed-window trade-off (a burst spanning a bucket boundary can
--    reach ~2x max) is acceptable in exchange for the count actually holding.
--
-- 2. searchUsers' username ILIKE '%q%' has no supporting index (a btree can't
--    serve a leading wildcard), so every autocomplete keystroke seq-scans
--    users. pg_trgm is already installed (1784106019139).
-- Up Migration

CREATE TABLE "rate_limit_counters" (
  "identifier" text NOT NULL,
  "action" text NOT NULL,
  "window_start" timestamptz NOT NULL,
  "count" integer NOT NULL DEFAULT 0,
  PRIMARY KEY ("identifier", "action", "window_start")
);

DROP TABLE IF EXISTS "rate_limit_attempts";

CREATE INDEX "users_username_trgm_idx" ON "users" USING gin (username gin_trgm_ops);

-- Down Migration

DROP INDEX IF EXISTS "users_username_trgm_idx";

CREATE TABLE "rate_limit_attempts" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "identifier" text NOT NULL,
  "action" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "rate_limit_identifier_action_idx" ON rate_limit_attempts USING btree (identifier, action, created_at);

DROP TABLE IF EXISTS "rate_limit_counters";
