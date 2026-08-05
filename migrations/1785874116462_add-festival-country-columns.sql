-- English country name + ISO-2 code for festivals, populated at import time
-- and backfilled for existing rows by scripts/backfill-festival-countries.ts.
-- Up Migration

ALTER TABLE "festivals" ADD COLUMN "country_code" text;
ALTER TABLE "festivals" ADD COLUMN "country_name" text;
CREATE INDEX "festivals_country_code_idx" ON "festivals" ("country_code");

-- Down Migration

DROP INDEX IF EXISTS "festivals_country_code_idx";
ALTER TABLE "festivals" DROP COLUMN IF EXISTS "country_name";
ALTER TABLE "festivals" DROP COLUMN IF EXISTS "country_code";
