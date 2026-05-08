CREATE INDEX "festival_artists_artist_name_idx" ON "festival_artists" USING btree ("artist_name");--> statement-breakpoint
CREATE INDEX "festivals_name_idx" ON "festivals" USING btree ("name");--> statement-breakpoint
CREATE INDEX "festivals_date_idx" ON "festivals" USING btree ("date");--> statement-breakpoint
CREATE INDEX "festivals_source_idx" ON "festivals" USING btree ("source");