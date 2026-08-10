-- The friendships migration added `updated_at DEFAULT now()`, which stamped
-- every pre-existing user_festivals row with the exact instant that ALTER
-- TABLE ran — not a real "last touched" time. That made the friends activity
-- feed's ORDER BY updated_at DESC put genuinely-new updates first (correct)
-- but leave every old row tied on the same frozen timestamp, sorting among
-- them arbitrarily. Reset those specific rows back to their created_at;
-- anything with a distinct updated_at is a real update and is left alone.
--
-- The frozen value is found dynamically (most common updated_at), not
-- hardcoded: a literal timestamp string round-trips through millisecond
-- rounding and won't equality-match the true microsecond-precision value
-- Postgres actually stored, silently matching zero rows.
-- Up Migration

UPDATE "user_festivals"
SET "updated_at" = "created_at"
WHERE "updated_at" = (
  SELECT "updated_at" FROM "user_festivals" GROUP BY "updated_at" ORDER BY count(*) DESC LIMIT 1
)
AND "updated_at" != "created_at";

-- Down Migration

-- Not meaningfully reversible — the original backfilled values weren't
-- preserved anywhere, and reverting to them would just reintroduce the bug
-- this migration fixes.
