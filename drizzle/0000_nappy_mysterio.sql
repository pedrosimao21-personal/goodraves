CREATE TABLE "artists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"spotify_id" text,
	"image_url" text,
	"genres" text,
	CONSTRAINT "artists_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "festival_artists" (
	"festival_id" text NOT NULL,
	"artist_name" text NOT NULL,
	CONSTRAINT "festival_artists_festival_id_artist_name_pk" PRIMARY KEY("festival_id","artist_name")
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
CREATE TABLE "user_artist_ratings" (
	"user_id" uuid NOT NULL,
	"festival_id" text NOT NULL,
	"artist_name" text NOT NULL,
	"rating" integer,
	"notes" text,
	CONSTRAINT "user_artist_ratings_user_id_festival_id_artist_name_pk" PRIMARY KEY("user_id","festival_id","artist_name")
);
--> statement-breakpoint
CREATE TABLE "user_festivals" (
	"user_id" uuid NOT NULL,
	"festival_id" text NOT NULL,
	"status" text DEFAULT 'attended' NOT NULL,
	"rating" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_festivals_user_id_festival_id_pk" PRIMARY KEY("user_id","festival_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "festival_artists" ADD CONSTRAINT "festival_artists_festival_id_festivals_id_fk" FOREIGN KEY ("festival_id") REFERENCES "public"."festivals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_artist_ratings" ADD CONSTRAINT "user_artist_ratings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_artist_ratings" ADD CONSTRAINT "user_artist_ratings_festival_id_festivals_id_fk" FOREIGN KEY ("festival_id") REFERENCES "public"."festivals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_festivals" ADD CONSTRAINT "user_festivals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_festivals" ADD CONSTRAINT "user_festivals_festival_id_festivals_id_fk" FOREIGN KEY ("festival_id") REFERENCES "public"."festivals"("id") ON DELETE cascade ON UPDATE no action;