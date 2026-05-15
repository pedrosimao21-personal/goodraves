CREATE TABLE "festival_b2b_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"festival_id" text NOT NULL,
	"original_artist_name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "festival_b2b_set_members" (
	"b2b_set_id" uuid NOT NULL,
	"artist_id" uuid NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "festival_b2b_set_members_b2b_set_id_artist_id_pk" PRIMARY KEY("b2b_set_id","artist_id")
);
--> statement-breakpoint
CREATE TABLE "user_festival_b2b_set_ratings" (
	"user_id" uuid NOT NULL,
	"b2b_set_id" uuid NOT NULL,
	"rating" integer,
	CONSTRAINT "user_festival_b2b_set_ratings_user_id_b2b_set_id_pk" PRIMARY KEY("user_id","b2b_set_id")
);
--> statement-breakpoint
ALTER TABLE "festival_b2b_sets" ADD CONSTRAINT "festival_b2b_sets_festival_id_festivals_id_fk" FOREIGN KEY ("festival_id") REFERENCES "public"."festivals"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "festival_b2b_set_members" ADD CONSTRAINT "festival_b2b_set_members_b2b_set_id_festival_b2b_sets_id_fk" FOREIGN KEY ("b2b_set_id") REFERENCES "public"."festival_b2b_sets"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "festival_b2b_set_members" ADD CONSTRAINT "festival_b2b_set_members_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_festival_b2b_set_ratings" ADD CONSTRAINT "user_festival_b2b_set_ratings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_festival_b2b_set_ratings" ADD CONSTRAINT "user_festival_b2b_set_ratings_b2b_set_id_festival_b2b_sets_id_fk" FOREIGN KEY ("b2b_set_id") REFERENCES "public"."festival_b2b_sets"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "festival_b2b_sets_festival_id_idx" ON "festival_b2b_sets" USING btree ("festival_id");
--> statement-breakpoint
CREATE INDEX "festival_b2b_set_members_artist_id_idx" ON "festival_b2b_set_members" USING btree ("artist_id");
