CREATE TABLE "user_artist_global" (
	"user_id" uuid NOT NULL,
	"artist_name" text NOT NULL,
	"rating" integer,
	"notes" text,
	CONSTRAINT "user_artist_global_user_id_artist_name_pk" PRIMARY KEY("user_id","artist_name")
);
--> statement-breakpoint
ALTER TABLE "user_artist_global" ADD CONSTRAINT "user_artist_global_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;