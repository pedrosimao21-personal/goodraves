-- Records when we last attempted a lineup re-import and an image backfill from
-- a festival's origin source. Without these, a festival whose lineup isn't
-- announced yet (or that has no image available) re-ran a full external import
-- on every single page view, forever.
-- Up Migration

ALTER TABLE "festivals" ADD COLUMN "lineup_checked_at" timestamptz;
ALTER TABLE "festivals" ADD COLUMN "image_checked_at" timestamptz;

-- Down Migration

ALTER TABLE "festivals" DROP COLUMN IF EXISTS "lineup_checked_at";
ALTER TABLE "festivals" DROP COLUMN IF EXISTS "image_checked_at";
