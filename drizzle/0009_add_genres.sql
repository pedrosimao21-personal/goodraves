CREATE TABLE "genres" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL UNIQUE
);
--> statement-breakpoint
CREATE TABLE "artist_genres" (
	"artist_id" uuid NOT NULL REFERENCES "artists"("id") ON DELETE cascade,
	"genre_id" uuid NOT NULL REFERENCES "genres"("id") ON DELETE cascade,
	CONSTRAINT "artist_genres_pkey" PRIMARY KEY("artist_id","genre_id")
);
--> statement-breakpoint
CREATE INDEX "artist_genres_genre_id_idx" ON "artist_genres" ("genre_id");
--> statement-breakpoint
ALTER TABLE "artists" DROP COLUMN IF EXISTS "lastfm_tags";
