-- Adds a table for the "want to see" feature: marking upcoming-festival
-- lineup artists you plan to catch, independent of attendance/seen-artist
-- tracking (see the note in schema.ts for why this is a separate table
-- rather than a column on user_festival_artist_ratings).
-- Up Migration

CREATE TABLE "user_artist_want_to_see" (
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "festival_id" text NOT NULL REFERENCES "festivals"("id") ON DELETE CASCADE,
  "artist_id" uuid NOT NULL REFERENCES "artists"("id") ON DELETE CASCADE,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("user_id", "festival_id", "artist_id")
);

-- Down Migration

DROP TABLE IF EXISTS "user_artist_want_to_see";
