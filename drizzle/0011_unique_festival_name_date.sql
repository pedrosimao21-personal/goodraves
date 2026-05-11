DROP INDEX IF EXISTS "festivals_name_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "festivals_name_date_idx" ON "festivals" USING btree ("name","date");
