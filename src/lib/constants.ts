/** Shared validation constants used by both client and server code. */
export const MAX_NOTES_LENGTH = 5000;
export const MAX_QUERY_LENGTH = 200;
/**
 * Shortest query the DB festival search accepts. pg_trgm indexes words as
 * 3-character trigrams, so a 1- or 2-character `ILIKE '%q%'` can't use the
 * trigram indexes at all — it degrades into a sequential scan over every
 * festival (and every artist name) to return an essentially arbitrary slice of
 * the newest 100 rows. External-source search is unaffected.
 */
export const MIN_SEARCH_QUERY_LENGTH = 3;
export const MAX_FESTIVAL_NAME_LENGTH = 500;
export const MAX_ARTIST_NAME_LENGTH = 300;
export const MIN_RATING = 1;
export const MAX_RATING = 5;
export const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;

/** Max number of artist names accepted by enrichArtistNamesBatch in one call. */
export const MAX_ENRICHMENT_BATCH_SIZE = 20;

/**
 * Chunk size for progressive festival-lineup image enrichment. The client
 * requests images in small sequential batches so they fill in progressively
 * instead of all-at-once after the full (necessarily serial — Spotify rate-limits
 * parallel search) enrichment completes. Sequential requests also keep us off the
 * parallel-search path Spotify blocks. See [[spotify-search-no-parallel]].
 */
export const IMAGE_ENRICH_CHUNK_SIZE = 6;

/**
 * Password length bounds for registration and password changes. bcrypt
 * silently ignores input past 72 bytes; the max mainly bounds hashing cost.
 */
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;

/** Emailed links: how long a verify-email / reset-password link works. */
export const EMAIL_VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
export const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
/** Per-caller limits for the unauthenticated email flows (per IP, and per address for reset requests). */
export const RATE_LIMIT_EMAIL_FLOW_MAX = 5;
export const RATE_LIMIT_EMAIL_FLOW_WINDOW_MS = 15 * 60 * 1000;
export const RATE_LIMIT_RESET_PER_ADDRESS_MAX = 3;
export const RATE_LIMIT_RESET_PER_ADDRESS_WINDOW_MS = 60 * 60 * 1000;
/** Verifying and resetting guess a 256-bit token: a looser cap per IP is plenty. */
export const RATE_LIMIT_TOKEN_REDEEM_MAX = 20;
/** Longest address RFC 5321 allows. */
export const MAX_EMAIL_LENGTH = 254;

/**
 * Notification emails sent by the daily cron. Resend's free plan allows 100 emails a
 * day and 2 requests a second; the limit leaves room for confirmation and reset
 * links, which are sent as they are asked for.
 */
export const NOTIFICATION_DAILY_LIMIT = 60;
export const NOTIFICATION_SEND_GAP_MS = 600;
export const NOTIFICATION_STEP_BUDGET_MS = 40_000;
/** A reminder goes out this many days before a festival on the user's list. */
export const NEXT_RAVE_REMINDER_DAYS_AHEAD = 3;
/** The monthly recap of last month is sent on the first days of the month, so a missed cron run still catches up. */
export const MONTHLY_RECAP_SEND_DAYS = 3;
export const MONTHLY_RECAP_MAX_FESTIVALS = 8;
/** Send records only matter for a few days; older ones are cleared. */
export const NOTIFICATION_SENDS_RETENTION_DAYS = 90;

/**
 * Profile photos live in Cloudflare R2, whose free tier is 10 GB, 1M writes and 10M reads a
 * month, and which bills past it. The browser shrinks the photo first (AVATAR_OUTPUT_SIZE
 * px square, a few KB); the server then refuses anything larger than a few times that, so
 * storage stays tiny whatever someone sends. The caps below keep writes far under the free
 * tier: 1,000 a day is 30,000 a month, 3% of it.
 */
export const AVATAR_OUTPUT_SIZE = 256;
export const AVATAR_OUTPUT_QUALITY = 0.85;
export const AVATAR_MAX_BYTES = 100 * 1024;
export const AVATAR_MIN_DIMENSION = 16;
export const AVATAR_MAX_DIMENSION = 512;
/** What the browser may pick before it shrinks the photo. */
export const AVATAR_MAX_SOURCE_BYTES = 15 * 1024 * 1024;
export const AVATAR_UPLOADS_PER_USER_PER_DAY = 5;
export const AVATAR_UPLOADS_PER_IP_PER_DAY = 20;
export const AVATAR_UPLOADS_SITE_PER_DAY = 1000;
export const AVATAR_RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;
/**
 * A photo never changes once uploaded (a new one gets a new name), but a removed one must stop being
 * served soon, and Cloudflare keeps serving a cached copy until this runs out. A day keeps reads from
 * the bucket in the hundreds of thousands a month at most, a small fraction of the free 10M.
 */
export const AVATAR_CACHE_CONTROL = "public, max-age=86400";

/** Max lengths for free-text profile fields. */
export const MAX_CITY_LENGTH = 200;
export const MAX_GENRES_LENGTH = 500;

/** Per-caller rate limits for server actions (window + max attempts per category). */
export const RATE_LIMIT_WINDOW_MS = 2 * 60 * 1000; // 2 minutes
export const RATE_LIMIT_IMPORT_MAX = 30;
export const RATE_LIMIT_SEARCH_MAX = 60;
export const RATE_LIMIT_CACHE_MAX = 10;
// Fallback festival-card image lookups fire per imageless card while browsing,
// so this limit is deliberately generous — it exists to cap abuse of the
// Spotify/Wikipedia proxy, not to throttle normal scrolling.
export const RATE_LIMIT_IMAGE_MAX = 200;
// Password change / account deletion both check the current password, so they
// share a tight limit against password guessing on a hijacked session.
export const RATE_LIMIT_ACCOUNT_MAX = 5;
/** rate_limit_counters rows (keyed by IP or user) older than this are pruned daily. Must exceed the longest window (15 min). */
export const RATE_LIMIT_RETENTION_HOURS = 24;

/**
 * Artist-enrichment cache staleness windows. Cached provider data is refetched
 * only once older than these (see README "External data sources"). Keeping them
 * here avoids the same magic ms expressions being redefined across action files.
 */
export const SPOTIFY_STALE_MS = 60 * 24 * 60 * 60 * 1000;         // ~60 days
export const LASTFM_STALE_MS = 7 * 24 * 60 * 60 * 1000;           // 7 days
export const RELATED_ARTISTS_STALE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const RA_EVENTS_STALE_MS = 24 * 60 * 60 * 1000;            // 1 day

/**
 * Re-check windows for the on-demand backfills in getFestival(). A festival with
 * no announced lineup — or no image at its source — used to re-run a full
 * external import on every page view because "missing" was the only trigger.
 * These windows are short enough to pick up a lineup announcement the same day
 * and long enough that browsing a not-yet-announced festival costs one DB read.
 */
export const LINEUP_RECHECK_STALE_MS = 6 * 60 * 60 * 1000;        // 6 hours
export const IMAGE_RECHECK_STALE_MS = 6 * 60 * 60 * 1000;         // 6 hours

/**
 * Hard timeout for outbound fetches to external providers (RA, FestivalFans,
 * Partyflock, Spotify, Last.fm, Wikipedia). These include HTML-scraped
 * third-party endpoints with no SLA, so a hung socket must not be able to
 * block a server action indefinitely.
 */
export const EXTERNAL_FETCH_TIMEOUT_MS = 10_000;

/** Daily Partyflock agenda import (scrapes the agenda page, imports the next 6 months). */
export const PF_AGENDA_DAYS_AHEAD = 183; // ~6 months
export const PF_AGENDA_REQUEST_DELAY_MS = 1500; // gap between successive partyflock requests
export const PF_AGENDA_MAX_RETRIES = 3;
export const PF_AGENDA_BACKOFF_BASE_MS = 1000; // exponential backoff base on failure

/** Days-before-event checkpoints at which imported Partyflock festivals are re-fetched/refreshed. */
export const PF_REFRESH_CHECKPOINT_DAYS = [7, 2] as const;

/** Festivals starting within this many days get their Partyflock timetable re-synced daily. */
export const TIMETABLE_REFRESH_DAYS_AHEAD = 14;
/** Festivals starting within this many days with no timetable are auto-matched to a Partyflock page. */
export const PF_AUTOLINK_DAYS_AHEAD = 30;
/** Don't search Partyflock again for the same unmatched festival more often than this. */
export const PF_AUTOLINK_RECHECK_DAYS = 3;

/** Artist photos from Resident Advisor (see src/db/actions/artist-photo-core.ts). */
/** An artist with no RA photo (or not on RA) isn't looked up again for this long. */
export const RA_PHOTO_RECHECK_DAYS = 90;
export const RA_PHOTO_REQUEST_DELAY_MS = 300; // gap between successive RA requests in a batch
export const RA_PHOTO_ON_DEMAND_CONCURRENCY = 3; // lineup views look a few artists up at once
export const RA_PHOTO_MAX_CONSECUTIVE_ERRORS = 5; // a batch stops after this many failed requests in a row
/** Pacing for the Spotify match verification (sequential: concurrent /search calls get 429-blocked). */
export const SPOTIFY_VERIFY_REQUEST_DELAY_MS = 500;
/** The verification stops after this many failed lookups in a row (each already left untouched). */
export const SPOTIFY_VERIFY_MAX_CONSECUTIVE_FAILURES = 5;
/** Artists the daily maintenance cron looks up on RA per run. */
export const RA_PHOTOS_PER_DAILY_RUN = 120;

// Re-reading RA event dates/times (festival-ra-schedule-core.ts).
export const RA_SCHEDULE_REQUEST_DELAY_MS = 300; // gap between successive RA requests in a batch
export const RA_SCHEDULE_MAX_CONSECUTIVE_FAILURES = 5; // a batch stops after this many empty RA answers in a row
export const RA_SCHEDULE_RECHECK_STALE_MS = 7 * 24 * 60 * 60 * 1000; // retry an event RA gave no answer for after a week
/** Stored Spotify matches the daily maintenance cron re-verifies per run (2 Spotify calls at most each). */
export const SPOTIFY_VERIFY_PER_DAILY_RUN = 60;

/** cron_runs rows older than this are pruned by each new cron run. */
export const CRON_RUN_RETENTION_DAYS = 90;
/** Runs per job listed in the /admin run history. */
export const ADMIN_CRON_HISTORY_LIMIT = 14;
/** /admin flags a daily job as overdue once its last finished run is older than this (24h + Hobby's ~59 min trigger slack). */
export const CRON_OVERDUE_HOURS = 26;
/** A cron_runs row still 'running' after this long was killed (routes cap at maxDuration = 300s). */
export const CRON_RUN_STUCK_MINUTES = 10;
/** Window for the /admin "recent activity" counts. */
export const ADMIN_RECENT_DAYS = 7;
