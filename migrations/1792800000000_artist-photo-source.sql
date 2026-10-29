-- Where an artist's photo came from, so a better source (Resident Advisor's
-- curated DJ photos) and admin fixes are never overwritten by a Spotify
-- lookup, plus the timestamps the daily jobs use to pace their work.
--
--   image_source          'ra' | 'spotify' | 'manual' (null = no photo)
--   image_locked          an admin fixed or removed the photo; nothing replaces it
--   ra_photo_checked_at   last RA photo lookup (found or not), so artists that
--                         aren't on RA aren't re-queried every day
--   spotify_verified_at   last time the stored Spotify match was checked against
--                         the artist's name (see spotify-verify-core.ts)
-- Up Migration

ALTER TABLE "artists"
  ADD COLUMN "image_source" text,
  ADD COLUMN "image_locked" boolean NOT NULL DEFAULT false,
  ADD COLUMN "ra_photo_checked_at" timestamptz,
  ADD COLUMN "spotify_verified_at" timestamptz;

-- Every existing photo came from Spotify.
UPDATE "artists" SET "image_source" = 'spotify' WHERE "image_url" IS NOT NULL;

-- Down Migration

ALTER TABLE "artists"
  DROP COLUMN "image_source",
  DROP COLUMN "image_locked",
  DROP COLUMN "ra_photo_checked_at",
  DROP COLUMN "spotify_verified_at";
