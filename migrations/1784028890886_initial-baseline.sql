-- Up Migration
--
-- Baseline schema, generated from the live production DB via Postgres's own
-- pg_get_*def catalog functions and validated (81 columns / 31 indexes / all
-- constraints / function + trigger) against prod. In production this migration is
-- recorded as already-applied via `npm run db:migrate -- --fake` (the objects
-- already exist). On a fresh/local/branch DB, `npm run db:migrate` runs it to
-- reproduce prod exactly.

CREATE TABLE "artist_genres" (
  "artist_id" uuid NOT NULL,
  "genre_id" uuid NOT NULL
);
CREATE TABLE "artists" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
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
  "ra_artist_id" text,
  "ra_upcoming_events" text,
  "ra_events_fetched_at" timestamp with time zone,
  "country_code" text,
  "country_name" text
);
CREATE TABLE "festival_artists" (
  "festival_id" text NOT NULL,
  "artist_id" uuid NOT NULL
);
CREATE TABLE "festival_b2b_set_members" (
  "b2b_set_id" uuid NOT NULL,
  "artist_id" uuid NOT NULL,
  "position" integer NOT NULL
);
CREATE TABLE "festival_b2b_sets" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "festival_id" text NOT NULL,
  "original_artist_name" text NOT NULL
);
CREATE TABLE "festival_timetable_slots" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "festival_id" text NOT NULL,
  "artist_id" uuid NOT NULL,
  "stage_name" text NOT NULL,
  "start_time" text NOT NULL,
  "end_time" text NOT NULL,
  "stage_order" integer NOT NULL,
  "slot_order" integer NOT NULL
);
CREATE TABLE "festivals" (
  "id" text NOT NULL,
  "name" text NOT NULL,
  "date" text NOT NULL,
  "end_date" text,
  "location" text,
  "venue" text,
  "latitude" real,
  "longitude" real,
  "source" text,
  "source_id" text,
  "image_url" text,
  "interested_count" integer DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "visitors_count" integer DEFAULT 0
);
CREATE TABLE "genres" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL
);
CREATE TABLE "rate_limit_attempts" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "identifier" text NOT NULL,
  "action" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE "user_artist_global" (
  "user_id" uuid NOT NULL,
  "rating" integer,
  "notes" text,
  "artist_id" uuid NOT NULL
);
CREATE TABLE "user_festival_artist_ratings" (
  "user_id" uuid NOT NULL,
  "festival_id" text NOT NULL,
  "rating" integer,
  "notes" text,
  "artist_id" uuid NOT NULL
);
CREATE TABLE "user_festivals" (
  "user_id" uuid NOT NULL,
  "festival_id" text NOT NULL,
  "rating" integer,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE "users" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "username" text NOT NULL,
  "password_hash" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "city" text,
  "favorite_genres" text,
  "is_admin" boolean DEFAULT false NOT NULL
);

ALTER TABLE "artist_genres" ADD CONSTRAINT "artist_genres_artist_id_genre_id_pk" PRIMARY KEY (artist_id, genre_id);
ALTER TABLE "artists" ADD CONSTRAINT "artists_pkey" PRIMARY KEY (id);
ALTER TABLE "festival_artists" ADD CONSTRAINT "festival_artists_festival_id_artist_id_pk" PRIMARY KEY (festival_id, artist_id);
ALTER TABLE "festival_b2b_set_members" ADD CONSTRAINT "festival_b2b_set_members_b2b_set_id_artist_id_pk" PRIMARY KEY (b2b_set_id, artist_id);
ALTER TABLE "festival_b2b_sets" ADD CONSTRAINT "festival_b2b_sets_pkey" PRIMARY KEY (id);
ALTER TABLE "festival_timetable_slots" ADD CONSTRAINT "festival_timetable_slots_pkey" PRIMARY KEY (id);
ALTER TABLE "festivals" ADD CONSTRAINT "festivals_pkey" PRIMARY KEY (id);
ALTER TABLE "genres" ADD CONSTRAINT "genres_name_unique" UNIQUE (name);
ALTER TABLE "genres" ADD CONSTRAINT "genres_pkey" PRIMARY KEY (id);
ALTER TABLE "rate_limit_attempts" ADD CONSTRAINT "rate_limit_attempts_pkey" PRIMARY KEY (id);
ALTER TABLE "user_artist_global" ADD CONSTRAINT "user_artist_global_user_id_artist_id_pk" PRIMARY KEY (user_id, artist_id);
ALTER TABLE "user_festival_artist_ratings" ADD CONSTRAINT "user_artist_ratings_user_id_festival_id_artist_id_pk" PRIMARY KEY (user_id, festival_id, artist_id);
ALTER TABLE "user_festivals" ADD CONSTRAINT "user_festivals_user_id_festival_id_pk" PRIMARY KEY (user_id, festival_id);
ALTER TABLE "users" ADD CONSTRAINT "users_pkey" PRIMARY KEY (id);
ALTER TABLE "users" ADD CONSTRAINT "users_username_unique" UNIQUE (username);
ALTER TABLE "artist_genres" ADD CONSTRAINT "artist_genres_artist_id_artists_id_fk" FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE;
ALTER TABLE "artist_genres" ADD CONSTRAINT "artist_genres_genre_id_genres_id_fk" FOREIGN KEY (genre_id) REFERENCES genres(id) ON DELETE CASCADE;
ALTER TABLE "festival_artists" ADD CONSTRAINT "festival_artists_artist_id_artists_id_fk" FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE RESTRICT;
ALTER TABLE "festival_artists" ADD CONSTRAINT "festival_artists_festival_id_festivals_id_fk" FOREIGN KEY (festival_id) REFERENCES festivals(id) ON DELETE CASCADE;
ALTER TABLE "festival_b2b_set_members" ADD CONSTRAINT "festival_b2b_set_members_artist_id_artists_id_fk" FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE;
ALTER TABLE "festival_b2b_set_members" ADD CONSTRAINT "festival_b2b_set_members_b2b_set_id_festival_b2b_sets_id_fk" FOREIGN KEY (b2b_set_id) REFERENCES festival_b2b_sets(id) ON DELETE CASCADE;
ALTER TABLE "festival_b2b_sets" ADD CONSTRAINT "festival_b2b_sets_festival_id_festivals_id_fk" FOREIGN KEY (festival_id) REFERENCES festivals(id) ON DELETE CASCADE;
ALTER TABLE "festival_timetable_slots" ADD CONSTRAINT "festival_timetable_slots_artist_id_artists_id_fk" FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE;
ALTER TABLE "festival_timetable_slots" ADD CONSTRAINT "festival_timetable_slots_festival_id_festivals_id_fk" FOREIGN KEY (festival_id) REFERENCES festivals(id) ON DELETE CASCADE;
ALTER TABLE "user_artist_global" ADD CONSTRAINT "user_artist_global_artist_id_artists_id_fk" FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE;
ALTER TABLE "user_artist_global" ADD CONSTRAINT "user_artist_global_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE "user_festival_artist_ratings" ADD CONSTRAINT "user_artist_ratings_artist_id_artists_id_fk" FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE;
ALTER TABLE "user_festival_artist_ratings" ADD CONSTRAINT "user_artist_ratings_festival_id_festivals_id_fk" FOREIGN KEY (festival_id) REFERENCES festivals(id) ON DELETE CASCADE;
ALTER TABLE "user_festival_artist_ratings" ADD CONSTRAINT "user_artist_ratings_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE "user_festivals" ADD CONSTRAINT "user_festivals_festival_id_festivals_id_fk" FOREIGN KEY (festival_id) REFERENCES festivals(id) ON DELETE CASCADE;
ALTER TABLE "user_festivals" ADD CONSTRAINT "user_festivals_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

CREATE INDEX artist_genres_genre_id_idx ON artist_genres USING btree (genre_id);
CREATE UNIQUE INDEX artists_name_ci_unique ON artists USING btree (lower(name));
CREATE INDEX artists_name_lower_idx ON artists USING btree (lower(name));
CREATE INDEX artists_ra_artist_id_idx ON artists USING btree (ra_artist_id) WHERE (ra_artist_id IS NOT NULL);
CREATE INDEX artists_spotify_followers_idx ON artists USING btree (spotify_followers);
CREATE INDEX festival_artists_artist_id_idx ON festival_artists USING btree (artist_id);
CREATE INDEX festival_b2b_set_members_artist_id_idx ON festival_b2b_set_members USING btree (artist_id);
CREATE INDEX festival_b2b_sets_festival_id_idx ON festival_b2b_sets USING btree (festival_id);
CREATE INDEX festival_timetable_slots_festival_id_idx ON festival_timetable_slots USING btree (festival_id);
CREATE UNIQUE INDEX festival_timetable_slots_unique_idx ON festival_timetable_slots USING btree (festival_id, artist_id, stage_name, start_time, end_time);
CREATE INDEX festivals_date_idx ON festivals USING btree (date);
CREATE INDEX festivals_interested_count_idx ON festivals USING btree (interested_count DESC);
CREATE UNIQUE INDEX festivals_name_date_idx ON festivals USING btree (name, date);
CREATE INDEX festivals_source_idx ON festivals USING btree (source);
CREATE INDEX rate_limit_identifier_action_idx ON rate_limit_attempts USING btree (identifier, action, created_at);
CREATE UNIQUE INDEX users_username_lower_idx ON users USING btree (lower(username));

CREATE OR REPLACE FUNCTION set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE TRIGGER festivals_set_updated_at BEFORE UPDATE ON festivals FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Down Migration

DROP TABLE IF EXISTS "artist_genres" CASCADE;
DROP TABLE IF EXISTS "artists" CASCADE;
DROP TABLE IF EXISTS "festival_artists" CASCADE;
DROP TABLE IF EXISTS "festival_b2b_set_members" CASCADE;
DROP TABLE IF EXISTS "festival_b2b_sets" CASCADE;
DROP TABLE IF EXISTS "festival_timetable_slots" CASCADE;
DROP TABLE IF EXISTS "festivals" CASCADE;
DROP TABLE IF EXISTS "genres" CASCADE;
DROP TABLE IF EXISTS "rate_limit_attempts" CASCADE;
DROP TABLE IF EXISTS "user_artist_global" CASCADE;
DROP TABLE IF EXISTS "user_festival_artist_ratings" CASCADE;
DROP TABLE IF EXISTS "user_festivals" CASCADE;
DROP TABLE IF EXISTS "users" CASCADE;
DROP FUNCTION IF EXISTS "set_updated_at"() CASCADE;
