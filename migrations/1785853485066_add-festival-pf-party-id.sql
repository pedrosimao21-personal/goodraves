-- Links a festival to a Partyflock party, so a timetable can be imported
-- for festivals whose own source (RA/FestivalFans) doesn't provide one.
-- Up Migration

ALTER TABLE "festivals" ADD COLUMN "pf_party_id" text;

-- Down Migration

ALTER TABLE "festivals" DROP COLUMN IF EXISTS "pf_party_id";
