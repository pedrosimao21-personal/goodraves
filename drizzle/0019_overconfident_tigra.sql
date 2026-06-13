DELETE FROM "festival_timetable_slots" a
USING "festival_timetable_slots" b
WHERE a.ctid > b.ctid
  AND a.festival_id = b.festival_id
  AND a.artist_id   = b.artist_id
  AND a.stage_name  = b.stage_name
  AND a.start_time  = b.start_time
  AND a.end_time    = b.end_time;
--> statement-breakpoint
CREATE UNIQUE INDEX "festival_timetable_slots_unique_idx" ON "festival_timetable_slots" USING btree ("festival_id","artist_id","stage_name","start_time","end_time");