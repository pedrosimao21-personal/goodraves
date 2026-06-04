CREATE TABLE "festival_timetable_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"festival_id" text NOT NULL,
	"artist_id" uuid NOT NULL,
	"stage_name" text NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"stage_order" integer NOT NULL,
	"slot_order" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "festival_timetable_slots" ADD CONSTRAINT "festival_timetable_slots_festival_id_festivals_id_fk" FOREIGN KEY ("festival_id") REFERENCES "public"."festivals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "festival_timetable_slots" ADD CONSTRAINT "festival_timetable_slots_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "festival_timetable_slots_festival_id_idx" ON "festival_timetable_slots" USING btree ("festival_id");