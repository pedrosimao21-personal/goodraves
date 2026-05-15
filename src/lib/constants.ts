/** Shared validation constants used by both client and server code. */
export const MAX_NOTES_LENGTH = 5000;
export const MAX_QUERY_LENGTH = 200;
export const MAX_FESTIVAL_NAME_LENGTH = 500;
export const MIN_RATING = 1;
export const MAX_RATING = 5;
export const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;

/** Usernames with admin privileges for global data mutations. */
export const ADMIN_USERNAMES: readonly string[] = ["Maarten", "pedrosimao21admin"];
