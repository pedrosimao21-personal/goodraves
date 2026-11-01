-- Optional profile photo. Holds the full public URL of the image in the R2 bucket
-- (served from img.goodraves.com); NULL means the user shows an initial instead.
-- The object lives at avatars/<user id>/<random>.<ext>, a new name on every upload so a
-- replaced photo is never served stale from the cache.

-- Up Migration

ALTER TABLE "users" ADD COLUMN "avatar_url" text;

-- Down Migration

ALTER TABLE "users" DROP COLUMN "avatar_url";
