/** Shared validation constants used by both client and server code. */
export const MAX_NOTES_LENGTH = 5000;
export const MAX_QUERY_LENGTH = 200;
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

/**
 * Artist-enrichment cache staleness windows. Cached provider data is refetched
 * only once older than these (see README "External data sources"). Keeping them
 * here avoids the same magic ms expressions being redefined across action files.
 */
export const SPOTIFY_STALE_MS = 60 * 24 * 60 * 60 * 1000;         // ~60 days
export const LASTFM_STALE_MS = 7 * 24 * 60 * 60 * 1000;           // 7 days
export const RELATED_ARTISTS_STALE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const RA_EVENTS_STALE_MS = 24 * 60 * 60 * 1000;            // 1 day

/** Daily Partyflock agenda import (scrapes the agenda page, imports the next 6 months). */
export const PF_AGENDA_DAYS_AHEAD = 183; // ~6 months
export const PF_AGENDA_REQUEST_DELAY_MS = 1500; // gap between successive partyflock requests
export const PF_AGENDA_MAX_RETRIES = 3;
export const PF_AGENDA_BACKOFF_BASE_MS = 1000; // exponential backoff base on failure

/** Days-before-event checkpoints at which imported Partyflock festivals are re-fetched/refreshed. */
export const PF_REFRESH_CHECKPOINT_DAYS = [7, 2] as const;
