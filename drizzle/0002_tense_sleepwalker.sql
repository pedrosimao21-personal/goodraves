ALTER TABLE "artists" DROP CONSTRAINT "artists_name_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "artists_name_ci_unique" ON "artists" USING btree (lower("name"));