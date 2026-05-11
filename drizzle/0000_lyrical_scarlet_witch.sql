-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"city" text,
	"favorite_genres" text,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "festivals" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"date" text NOT NULL,
	"end_date" text,
	"location" text,
	"venue" text,
	"latitude" real,
	"longitude" real,
	"source" text,
	"source_id" text,
	"image_url" text
);
--> statement-breakpoint
CREATE TABLE "rate_limit_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"action" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "artists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"spotify_id" text,
	"image_url" text,
	"spotify_fetched_at" timestamp with time zone,
	"spotify_followers" integer,
	"spotify_albums" text,
	"lastfm_id" text,
	"lastfm_bio" text,
	"lastfm_listeners" integer,
	"lastfm_playcount" integer,
	"lastfm_similar" text,
	"lastfm_top_tracks" text,
	"lastfm_fetched_at" timestamp with time zone,
	"related_artists" text,
	"related_artists_fetched_at" timestamp with time zone,
	CONSTRAINT "artists_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "genres" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "genres_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "festival_artists" (
	"festival_id" text NOT NULL,
	"artist_id" uuid NOT NULL,
	CONSTRAINT "festival_artists_festival_id_artist_id_pk" PRIMARY KEY("festival_id","artist_id")
);
--> statement-breakpoint
CREATE TABLE "artist_genres" (
	"artist_id" uuid NOT NULL,
	"genre_id" uuid NOT NULL,
	CONSTRAINT "artist_genres_artist_id_genre_id_pk" PRIMARY KEY("artist_id","genre_id")
);
--> statement-breakpoint
CREATE TABLE "user_artist_global" (
	"user_id" uuid NOT NULL,
	"rating" integer,
	"notes" text,
	"artist_id" uuid NOT NULL,
	CONSTRAINT "user_artist_global_user_id_artist_id_pk" PRIMARY KEY("user_id","artist_id")
);
--> statement-breakpoint
CREATE TABLE "user_festival_artist_ratings" (
	"user_id" uuid NOT NULL,
	"festival_id" text NOT NULL,
	"rating" integer,
	"notes" text,
	"artist_id" uuid NOT NULL,
	CONSTRAINT "user_artist_ratings_user_id_festival_id_artist_id_pk" PRIMARY KEY("user_id","festival_id","artist_id")
);
--> statement-breakpoint
CREATE TABLE "user_festivals" (
	"user_id" uuid NOT NULL,
	"festival_id" text NOT NULL,
	"rating" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'attended' NOT NULL,
	CONSTRAINT "user_festivals_user_id_festival_id_pk" PRIMARY KEY("user_id","festival_id")
);
--> statement-breakpoint
ALTER TABLE "festival_artists" ADD CONSTRAINT "festival_artists_festival_id_festivals_id_fk" FOREIGN KEY ("festival_id") REFERENCES "public"."festivals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "festival_artists" ADD CONSTRAINT "festival_artists_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artist_genres" ADD CONSTRAINT "artist_genres_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artist_genres" ADD CONSTRAINT "artist_genres_genre_id_genres_id_fk" FOREIGN KEY ("genre_id") REFERENCES "public"."genres"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_artist_global" ADD CONSTRAINT "user_artist_global_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_artist_global" ADD CONSTRAINT "user_artist_global_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_festival_artist_ratings" ADD CONSTRAINT "user_artist_ratings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_festival_artist_ratings" ADD CONSTRAINT "user_artist_ratings_festival_id_festivals_id_fk" FOREIGN KEY ("festival_id") REFERENCES "public"."festivals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_festival_artist_ratings" ADD CONSTRAINT "user_artist_ratings_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_festivals" ADD CONSTRAINT "user_festivals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_festivals" ADD CONSTRAINT "user_festivals_festival_id_festivals_id_fk" FOREIGN KEY ("festival_id") REFERENCES "public"."festivals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "festivals_date_idx" ON "festivals" USING btree ("date" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "festivals_name_date_idx" ON "festivals" USING btree ("name" text_ops,"date" text_ops);--> statement-breakpoint
CREATE INDEX "festivals_source_idx" ON "festivals" USING btree ("source" text_ops);--> statement-breakpoint
CREATE INDEX "rate_limit_identifier_action_idx" ON "rate_limit_attempts" USING btree ("identifier" text_ops,"action" text_ops,"created_at" text_ops);--> statement-breakpoint
CREATE INDEX "artists_spotify_followers_idx" ON "artists" USING btree ("spotify_followers" int4_ops);--> statement-breakpoint
CREATE INDEX "festival_artists_artist_id_idx" ON "festival_artists" USING btree ("artist_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "artist_genres_genre_id_idx" ON "artist_genres" USING btree ("genre_id" uuid_ops);
*/