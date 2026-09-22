-- Daily maintenance cron (src/app/api/cron/daily-maintenance):
--
-- 1. festival_duplicate_candidates — review queue for the daily dedupe. Pairs
--    that look like the same event but aren't certain enough to auto-merge
--    wait here for an admin (/admin/duplicates). Dismissed pairs keep their
--    row so they're never suggested again; a merge deletes the loser festival,
--    which cascades its candidate rows away.
--
-- 2. festivals.pf_link_checked_at — when the cron last searched Partyflock
--    for a festival's timetable without finding one to link, so the same
--    unmatched festivals aren't re-searched on every daily run.
-- Up Migration

CREATE TABLE "festival_duplicate_candidates" (
  "festival_a" text NOT NULL REFERENCES "festivals"("id") ON DELETE CASCADE,
  "festival_b" text NOT NULL REFERENCES "festivals"("id") ON DELETE CASCADE,
  "reason" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("festival_a", "festival_b"),
  CHECK ("festival_a" < "festival_b")
);
CREATE INDEX "festival_duplicate_candidates_status_idx" ON "festival_duplicate_candidates" ("status");
-- The PK covers lookups by festival_a; cascade deletes by festival_b need their own index.
CREATE INDEX "festival_duplicate_candidates_festival_b_idx" ON "festival_duplicate_candidates" ("festival_b");

ALTER TABLE "festivals" ADD COLUMN "pf_link_checked_at" timestamptz;

-- Down Migration

ALTER TABLE "festivals" DROP COLUMN IF EXISTS "pf_link_checked_at";
DROP TABLE IF EXISTS "festival_duplicate_candidates";
