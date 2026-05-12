-- Add RA artist ID and cached upcoming events to artists table
ALTER TABLE artists ADD COLUMN IF NOT EXISTS ra_artist_id TEXT;
ALTER TABLE artists ADD COLUMN IF NOT EXISTS ra_upcoming_events TEXT;
ALTER TABLE artists ADD COLUMN IF NOT EXISTS ra_events_fetched_at TIMESTAMPTZ;

-- Index for looking up artists by RA ID
CREATE INDEX IF NOT EXISTS artists_ra_artist_id_idx ON artists(ra_artist_id) WHERE ra_artist_id IS NOT NULL;
