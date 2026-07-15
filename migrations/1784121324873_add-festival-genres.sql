-- Links festivals to genres (many-to-many), mirroring artist_genres.
-- Up Migration

CREATE TABLE "festival_genres" (
  "festival_id" text NOT NULL,
  "genre_id" uuid NOT NULL
);

ALTER TABLE "festival_genres" ADD CONSTRAINT "festival_genres_festival_id_genre_id_pk" PRIMARY KEY (festival_id, genre_id);

ALTER TABLE "festival_genres" ADD CONSTRAINT "festival_genres_festival_id_festivals_id_fk" FOREIGN KEY (festival_id) REFERENCES festivals(id) ON DELETE CASCADE;
ALTER TABLE "festival_genres" ADD CONSTRAINT "festival_genres_genre_id_genres_id_fk" FOREIGN KEY (genre_id) REFERENCES genres(id) ON DELETE CASCADE;

CREATE INDEX festival_genres_genre_id_idx ON festival_genres USING btree (genre_id);

-- Down Migration

DROP TABLE IF EXISTS "festival_genres" CASCADE;
