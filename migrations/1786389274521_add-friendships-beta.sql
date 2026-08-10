-- Friends system (beta): a friendships table plus the two columns the
-- activity feed needs on user_festivals — `updated_at` (so the feed can
-- order by recency; only created_at existed before, which never moves when
-- a rating changes later) and `public_comment` (deliberately NOT the
-- existing `notes` column, which is presented to users as private).
-- Up Migration

CREATE TABLE "friendships" (
  "requester_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "addressee_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "status" text NOT NULL DEFAULT 'pending',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("requester_id", "addressee_id")
);

CREATE INDEX "friendships_addressee_status_idx" ON "friendships" ("addressee_id", "status");

ALTER TABLE "user_festivals" ADD COLUMN "updated_at" timestamptz NOT NULL DEFAULT now();
ALTER TABLE "user_festivals" ADD COLUMN "public_comment" text;

-- The feed filters by a SET of friend user_ids and sorts globally by
-- recency (not "one user's own list"), so the index leads with updated_at:
-- Postgres walks it newest-first and checks membership per row, stopping
-- once LIMIT is satisfied.
CREATE INDEX "user_festivals_updated_at_idx" ON "user_festivals" ("updated_at" DESC);

-- Down Migration

DROP INDEX IF EXISTS "user_festivals_updated_at_idx";
ALTER TABLE "user_festivals" DROP COLUMN IF EXISTS "public_comment";
ALTER TABLE "user_festivals" DROP COLUMN IF EXISTS "updated_at";

DROP TABLE IF EXISTS "friendships";
