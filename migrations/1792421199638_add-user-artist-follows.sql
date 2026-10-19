-- Adds artist following: a user follows an artist to see that artist's
-- upcoming festivals (from our own festival_artists lineups) on /following.
-- The artist_id index backs "which friends follow this artist" and the
-- per-artist lookups; the (user_id, created_at) index backs the friends
-- feed's "started following" stream, which pages newest-first by created_at.
-- Up Migration

CREATE TABLE "user_artist_follows" (
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "artist_id" uuid NOT NULL REFERENCES "artists"("id") ON DELETE CASCADE,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("user_id", "artist_id")
);

CREATE INDEX "user_artist_follows_artist_id_idx" ON "user_artist_follows" ("artist_id");
CREATE INDEX "user_artist_follows_user_created_idx" ON "user_artist_follows" ("user_id", "created_at" DESC);

-- Down Migration

DROP TABLE IF EXISTS "user_artist_follows";
