-- migrateRatingsToMembers (b2b-split.ts) filters user_festival_artist_ratings by
-- festivalId + artistId without userId, which can't use a leftmost prefix of the
-- (userId, festivalId, artistId) primary key. Also drops the redundant plain
-- index on lower(artists.name) — the existing artists_name_ci_unique unique
-- index already serves those lookups.
-- Up Migration

CREATE INDEX "user_festival_artist_ratings_festival_artist_idx" ON "user_festival_artist_ratings" USING btree ("festival_id", "artist_id");

DROP INDEX IF EXISTS "artists_name_lower_idx";

-- Down Migration

DROP INDEX IF EXISTS "user_festival_artist_ratings_festival_artist_idx";

CREATE INDEX "artists_name_lower_idx" ON "artists" USING btree (lower("name"));
