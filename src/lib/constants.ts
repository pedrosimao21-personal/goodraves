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

/** Max lengths for free-text profile fields. */
export const MAX_CITY_LENGTH = 200;
export const MAX_GENRES_LENGTH = 500;

/** Per-caller rate limits for server actions (window + max attempts per category). */
export const RATE_LIMIT_WINDOW_MS = 2 * 60 * 1000; // 2 minutes
export const RATE_LIMIT_IMPORT_MAX = 30;
export const RATE_LIMIT_SEARCH_MAX = 60;
export const RATE_LIMIT_CACHE_MAX = 10;

/** Daily Partyflock agenda import (scrapes the agenda page, imports the next 6 months). */
export const PF_AGENDA_DAYS_AHEAD = 183; // ~6 months
export const PF_AGENDA_REQUEST_DELAY_MS = 1500; // gap between successive partyflock requests
export const PF_AGENDA_MAX_RETRIES = 3;
export const PF_AGENDA_BACKOFF_BASE_MS = 1000; // exponential backoff base on failure

/** Days-before-event checkpoints at which imported Partyflock festivals are re-fetched/refreshed. */
export const PF_REFRESH_CHECKPOINT_DAYS = [7, 2] as const;
