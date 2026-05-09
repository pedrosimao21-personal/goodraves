-- Rename user_artist_ratings to user_festival_artist_ratings for clarity
-- This table stores per-festival artist ratings, distinct from user_artist_global (overall ratings).

ALTER TABLE "user_artist_ratings" RENAME TO "user_festival_artist_ratings";
