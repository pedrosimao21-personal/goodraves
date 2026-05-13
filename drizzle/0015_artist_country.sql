-- Add country fields to artists table (from Resident Advisor)
ALTER TABLE artists ADD COLUMN IF NOT EXISTS country_code TEXT;
ALTER TABLE artists ADD COLUMN IF NOT EXISTS country_name TEXT;
