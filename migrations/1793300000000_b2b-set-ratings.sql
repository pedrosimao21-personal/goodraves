-- A user's rating of one B2B set, stored on the set itself.
--
-- Until now a set had no rating of its own: rating it wrote the same rating to each member's
-- per-festival row (user_festival_artist_ratings) and the card showed its FIRST member's rating.
-- Two sets that share a member (Armin van Buuren b2b Deep Dish, Armin van Buuren b2b Funk Tribu)
-- therefore shared one rating: rating one set rated the other, and clearing it cleared both.
-- Now each set keeps its own rating here, and a member's festival rating is worked out from the
-- sets they are in (see rate-b2b-set.ts), so artist stats and "seen" keep working.

-- Up Migration

CREATE TABLE "user_b2b_set_ratings" (
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "b2b_set_id" uuid NOT NULL REFERENCES "festival_b2b_sets"("id") ON DELETE CASCADE,
  "rating" real NOT NULL,
  PRIMARY KEY ("user_id", "b2b_set_id")
);

CREATE INDEX "user_b2b_set_ratings_set_idx" ON "user_b2b_set_ratings" ("b2b_set_id");

-- Keep every rating the cards show today: each set's rating is its first member's rating.
INSERT INTO "user_b2b_set_ratings" ("user_id", "b2b_set_id", "rating")
SELECT r."user_id", s."id", r."rating"
FROM "festival_b2b_sets" s
JOIN "festival_b2b_set_members" m
  ON m."b2b_set_id" = s."id"
 AND m."position" = (SELECT min("position") FROM "festival_b2b_set_members" WHERE "b2b_set_id" = s."id")
JOIN "user_festival_artist_ratings" r
  ON r."festival_id" = s."festival_id" AND r."artist_id" = m."artist_id"
WHERE r."rating" IS NOT NULL AND r."rating" > 0;

-- Down Migration

DROP TABLE "user_b2b_set_ratings";
