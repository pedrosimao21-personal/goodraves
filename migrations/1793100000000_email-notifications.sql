-- Opt-in email notifications: which ones a user turned on, and a ledger of what
-- was already sent so the daily cron never mails the same thing twice.
--
-- Everything is off until the user switches it on (profile > Notifications), and
-- mail only goes to a confirmed address. `notification_sends` doubles as the
-- daily send counter (Resend's free plan allows 100 emails a day) and as the
-- claim taken before sending: the primary key makes a second cron run, or two
-- overlapping ones, skip a message that is already claimed.
-- `ref` is what the message is about: a festival id for a reminder, "YYYY-MM"
-- for a monthly recap.

-- Up Migration

CREATE TABLE "user_notification_settings" (
  "user_id" uuid PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "next_rave_reminder" boolean NOT NULL DEFAULT false,
  "monthly_recap" boolean NOT NULL DEFAULT false,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "notification_sends" (
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "kind" text NOT NULL,
  "ref" text NOT NULL,
  "sent_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("user_id", "kind", "ref")
);

CREATE INDEX "notification_sends_sent_at_idx" ON "notification_sends" ("sent_at");

-- Down Migration

DROP TABLE "notification_sends";
DROP TABLE "user_notification_settings";
