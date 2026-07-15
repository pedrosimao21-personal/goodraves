-- Speeds up the free-text festival search (searchFestivalsDB / getNearbyShows),
-- which matches with leading-wildcard `ILIKE '%q%'` on festival name/venue/location
-- and artist name. A plain btree can't serve a leading wildcard, so these were
-- full scans. pg_trgm GIN indexes make ILIKE substring matches index-backed.

-- Up Migration

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS festivals_name_trgm_idx
  ON festivals USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS festivals_venue_trgm_idx
  ON festivals USING gin (venue gin_trgm_ops);
CREATE INDEX IF NOT EXISTS festivals_location_trgm_idx
  ON festivals USING gin (location gin_trgm_ops);
CREATE INDEX IF NOT EXISTS artists_name_trgm_idx
  ON artists USING gin (name gin_trgm_ops);

-- Down Migration

DROP INDEX IF EXISTS festivals_name_trgm_idx;
DROP INDEX IF EXISTS festivals_venue_trgm_idx;
DROP INDEX IF EXISTS festivals_location_trgm_idx;
DROP INDEX IF EXISTS artists_name_trgm_idx;
-- Note: the pg_trgm extension is intentionally left installed on down-migrate;
-- other objects may depend on it and dropping an extension is rarely desired.
