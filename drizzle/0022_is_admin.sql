ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_admin" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
UPDATE "users" SET "is_admin" = true WHERE "username" IN ('Maarten', 'pedrosimao21admin');
