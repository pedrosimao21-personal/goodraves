ALTER TABLE "artists" ADD COLUMN "spotify_url" text;--> statement-breakpoint
ALTER TABLE "artists" ADD COLUMN "spotify_followers" integer;--> statement-breakpoint
ALTER TABLE "artists" ADD COLUMN "spotify_albums" text;--> statement-breakpoint
ALTER TABLE "artists" ADD COLUMN "lastfm_id" text;--> statement-breakpoint
ALTER TABLE "artists" ADD COLUMN "lastfm_url" text;--> statement-breakpoint
ALTER TABLE "artists" ADD COLUMN "lastfm_bio" text;--> statement-breakpoint
ALTER TABLE "artists" ADD COLUMN "lastfm_tags" text;--> statement-breakpoint
ALTER TABLE "artists" ADD COLUMN "lastfm_listeners" integer;--> statement-breakpoint
ALTER TABLE "artists" ADD COLUMN "lastfm_playcount" integer;--> statement-breakpoint
ALTER TABLE "artists" ADD COLUMN "lastfm_similar" text;--> statement-breakpoint
ALTER TABLE "artists" ADD COLUMN "lastfm_top_tracks" text;--> statement-breakpoint
ALTER TABLE "artists" ADD COLUMN "lastfm_fetched_at" timestamp with time zone;