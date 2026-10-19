-- Adds cron_runs: one row per run of a Vercel Cron job, so /admin can show
-- run history. A row is inserted with status 'running' when the job starts
-- and updated when it finishes; a run killed at Vercel's maxDuration keeps
-- finished_at NULL, which the dashboard shows as "never finished".
-- summary holds the route's JSON response (JSON.stringify'd text, like the
-- other JSON blobs in this schema). The (job, started_at DESC) index backs
-- the per-job "latest N runs" query.
-- Up Migration

CREATE TABLE "cron_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "job" text NOT NULL,
  "status" text NOT NULL DEFAULT 'running',
  "started_at" timestamptz NOT NULL DEFAULT now(),
  "finished_at" timestamptz,
  "summary" text,
  "error" text
);

CREATE INDEX "cron_runs_job_started_at_idx" ON "cron_runs" ("job", "started_at" DESC);

-- Down Migration

DROP TABLE IF EXISTS "cron_runs";
