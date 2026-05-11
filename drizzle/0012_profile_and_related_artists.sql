-- Add city and favorite_genres to users table
ALTER TABLE "users" ADD COLUMN "city" text;
ALTER TABLE "users" ADD COLUMN "favorite_genres" text;

-- Add related_artists cache columns to artists table
ALTER TABLE "artists" ADD COLUMN "related_artists" text;
ALTER TABLE "artists" ADD COLUMN "related_artists_fetched_at" timestamp with time zone;

-- Index for fast popular DJ queries (ORDER BY spotify_followers DESC)
CREATE INDEX IF NOT EXISTS "artists_spotify_followers_idx" ON "artists" ("spotify_followers");
