-- Optional email address on accounts (log in with it, reset a forgotten password,
-- later: notifications) and the single-use tokens behind the emailed links.
--
-- `email` holds the address the user entered; it only counts once `email_verified_at`
-- is set (they clicked the link we mailed). Login by email and password reset use
-- verified addresses only. The unique index is case-insensitive, like the username one.
-- Tokens are stored as a SHA-256 hash, never in the clear.

-- Up Migration

ALTER TABLE "users"
  ADD COLUMN "email" text,
  ADD COLUMN "email_verified_at" timestamptz;

CREATE UNIQUE INDEX "users_email_lower_idx" ON "users" (lower("email")) WHERE "email" IS NOT NULL;

CREATE TABLE "auth_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "kind" text NOT NULL,
  "token_hash" text NOT NULL UNIQUE,
  "email" text NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "used_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "auth_tokens_user_kind_idx" ON "auth_tokens" ("user_id", "kind");

-- Down Migration

DROP TABLE "auth_tokens";
DROP INDEX "users_email_lower_idx";
ALTER TABLE "users" DROP COLUMN "email_verified_at", DROP COLUMN "email";
