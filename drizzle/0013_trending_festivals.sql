-- Migration 0013: Add interested_count to festivals table for RA trending data
ALTER TABLE "festivals" ADD COLUMN IF NOT EXISTS "interested_count" integer DEFAULT 0;
CREATE INDEX IF NOT EXISTS "festivals_interested_count_idx" ON "festivals" ("interested_count" DESC);
