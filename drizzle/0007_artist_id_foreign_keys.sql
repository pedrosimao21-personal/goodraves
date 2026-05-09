-- Migration: Replace artist_name (text) with artist_id (uuid) FK in
-- festival_artists, user_artist_ratings, and user_artist_global.
-- Data is preserved by looking up artists.id via artists.name.

-- ============================================================
-- 1. festival_artists
-- ============================================================

-- Add new column
ALTER TABLE "festival_artists" ADD COLUMN "artist_id" uuid;

-- Populate from artists table
UPDATE "festival_artists" fa
SET "artist_id" = a."id"
FROM "artists" a
WHERE a."name" = fa."artist_name";

-- Drop rows that couldn't be resolved (orphans with no matching artist)
DELETE FROM "festival_artists" WHERE "artist_id" IS NULL;

-- Drop old PK, FK, and index
ALTER TABLE "festival_artists" DROP CONSTRAINT "festival_artists_festival_id_artist_name_pk";
DROP INDEX IF EXISTS "festival_artists_artist_name_idx";

-- Drop old column
ALTER TABLE "festival_artists" DROP COLUMN "artist_name";

-- Make new column NOT NULL and add FK + PK + index
ALTER TABLE "festival_artists" ALTER COLUMN "artist_id" SET NOT NULL;
ALTER TABLE "festival_artists" ADD CONSTRAINT "festival_artists_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "artists"("id") ON DELETE restrict;
ALTER TABLE "festival_artists" ADD CONSTRAINT "festival_artists_festival_id_artist_id_pk" PRIMARY KEY ("festival_id", "artist_id");
CREATE INDEX "festival_artists_artist_id_idx" ON "festival_artists" ("artist_id");

-- ============================================================
-- 2. user_artist_ratings
-- ============================================================

-- Add new column
ALTER TABLE "user_artist_ratings" ADD COLUMN "artist_id" uuid;

-- Populate from artists table
UPDATE "user_artist_ratings" uar
SET "artist_id" = a."id"
FROM "artists" a
WHERE a."name" = uar."artist_name";

-- Drop rows that couldn't be resolved
DELETE FROM "user_artist_ratings" WHERE "artist_id" IS NULL;

-- Drop old PK
ALTER TABLE "user_artist_ratings" DROP CONSTRAINT "user_artist_ratings_user_id_festival_id_artist_name_pk";

-- Drop old column
ALTER TABLE "user_artist_ratings" DROP COLUMN "artist_name";

-- Make new column NOT NULL and add FK + PK
ALTER TABLE "user_artist_ratings" ALTER COLUMN "artist_id" SET NOT NULL;
ALTER TABLE "user_artist_ratings" ADD CONSTRAINT "user_artist_ratings_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "artists"("id") ON DELETE cascade;
ALTER TABLE "user_artist_ratings" ADD CONSTRAINT "user_artist_ratings_user_id_festival_id_artist_id_pk" PRIMARY KEY ("user_id", "festival_id", "artist_id");

-- ============================================================
-- 3. user_artist_global
-- ============================================================

-- Add new column
ALTER TABLE "user_artist_global" ADD COLUMN "artist_id" uuid;

-- Populate from artists table
UPDATE "user_artist_global" uag
SET "artist_id" = a."id"
FROM "artists" a
WHERE a."name" = uag."artist_name";

-- Drop rows that couldn't be resolved
DELETE FROM "user_artist_global" WHERE "artist_id" IS NULL;

-- Drop old PK
ALTER TABLE "user_artist_global" DROP CONSTRAINT "user_artist_global_user_id_artist_name_pk";

-- Drop old column
ALTER TABLE "user_artist_global" DROP COLUMN "artist_name";

-- Make new column NOT NULL and add FK + PK
ALTER TABLE "user_artist_global" ALTER COLUMN "artist_id" SET NOT NULL;
ALTER TABLE "user_artist_global" ADD CONSTRAINT "user_artist_global_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "artists"("id") ON DELETE cascade;
ALTER TABLE "user_artist_global" ADD CONSTRAINT "user_artist_global_user_id_artist_id_pk" PRIMARY KEY ("user_id", "artist_id");
