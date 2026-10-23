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
