-- Artist and set ratings can now be given in half points (0.5..5). Existing
-- whole-number ratings convert unchanged (4 -> 4.0). Festival vibe ratings
-- (user_festivals.rating) stay integer.
-- Up Migration

ALTER TABLE "user_festival_artist_ratings" ALTER COLUMN "rating" TYPE real;
ALTER TABLE "user_artist_global" ALTER COLUMN "rating" TYPE real;

-- Down Migration

ALTER TABLE "user_festival_artist_ratings" ALTER COLUMN "rating" TYPE integer USING round("rating")::integer;
ALTER TABLE "user_artist_global" ALTER COLUMN "rating" TYPE integer USING round("rating")::integer;
