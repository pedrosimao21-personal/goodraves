-- Announced start/end clock times ("HH:MM") for festivals, and the stamp of the
-- last attempt to read them (and re-check the dates) from Resident Advisor.
-- Existing rows are filled by scripts/backfill-festival-schedules.ts and, for
-- any stragglers, on first view of the festival page.

-- Up Migration

ALTER TABLE "festivals"
  ADD COLUMN "start_time" text,
  ADD COLUMN "end_time" text,
  ADD COLUMN "times_checked_at" timestamptz;
