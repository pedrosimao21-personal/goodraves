-- Admin lineup edits that survive re-imports (src/db/actions/lineup-admin-core.ts).
--
-- Imports rebuild a festival's lineup from the source on every refresh, so an
-- artist an admin removed (or merged into another) would come straight back.
-- Each row says: "for this festival, ignore the artist whose name folds to
-- name_key" — and, for a merge, which artist (replaced_by_name) to use instead.
-- Keyed by the folded NAME, not an artist id: a merged-away artist row can be
-- deleted and re-created with a new id by the next import.
-- Up Migration

CREATE TABLE "festival_lineup_exclusions" (
  "festival_id" text NOT NULL REFERENCES "festivals"("id") ON DELETE CASCADE,
  "name_key" text NOT NULL,
  "replaced_by_name" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("festival_id", "name_key")
);

-- Down Migration

DROP TABLE "festival_lineup_exclusions";
