-- Adds a day dimension to festival_timetable_slots (bare "HH:MM" times can't
-- otherwise distinguish two days reusing the same stage name at the same
-- clock time) and a festival_merges audit table for the hard-merge dedup
-- feature (records what got merged into what, for URL redirects + undo).
-- Up Migration

ALTER TABLE "festival_timetable_slots" ADD COLUMN "slot_date" text;

UPDATE "festival_timetable_slots" AS ts
SET "slot_date" = f."date"
FROM "festivals" AS f
WHERE f."id" = ts."festival_id" AND ts."slot_date" IS NULL;

ALTER TABLE "festival_timetable_slots" ALTER COLUMN "slot_date" SET NOT NULL;

DROP INDEX IF EXISTS "festival_timetable_slots_unique_idx";
CREATE UNIQUE INDEX "festival_timetable_slots_unique_idx"
  ON "festival_timetable_slots" ("festival_id", "artist_id", "stage_name", "start_time", "end_time", "slot_date");

CREATE TABLE "festival_merges" (
  "loser_id" text PRIMARY KEY,
  "winner_id" text NOT NULL,
  "merged_at" timestamptz NOT NULL DEFAULT now(),
  "snapshot" text NOT NULL
);

CREATE INDEX "festival_merges_winner_id_idx" ON "festival_merges" ("winner_id");

-- Down Migration

DROP TABLE IF EXISTS "festival_merges";

DROP INDEX IF EXISTS "festival_timetable_slots_unique_idx";
CREATE UNIQUE INDEX "festival_timetable_slots_unique_idx"
  ON "festival_timetable_slots" ("festival_id", "artist_id", "stage_name", "start_time", "end_time");
ALTER TABLE "festival_timetable_slots" DROP COLUMN IF EXISTS "slot_date";
