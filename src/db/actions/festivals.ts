/**
 * Public API for festival-related server actions.
 *
 * This file re-exports the public API from focused submodules:
 *   - festival-search:     DB / RA / FestivalFans search
 *   - festival-data:       getFestival, getFullUserData
 *   - festival-attendance: attendance, ratings, notes, artist toggles
 *   - festival-import:     upsert, batch import, RA/FF fetch & reimport
 *
 * External service clients live in src/services/ (ra, festivalfans, spotify, etc.)
 */

// Search
export { searchFestivalsDB, searchRAEvents, searchFFEvents } from "./festival-search";

// Data reads
export { getFestival, getFullUserData } from "./festival-data";

// User attendance & ratings
export {
  addAttendance,
  removeAttendance,
  setFestivalNotes,
  rateFestival,
  toggleSawArtist,
  rateArtist,
  clearUserFestivals,
  setGlobalArtistRating,
  setGlobalArtistNotes,
} from "./festival-attendance";

// Import & upsert
export {
  upsertFestival,
  batchImportFestivals,
} from "./festival-import";

// RA import
export { reimportRAEvent, fetchRAEvent } from "./festival-import-ra";

// FestivalFans import
export { reimportFFEvent, fetchFFEvent } from "./festival-import-ff";

// FestivalFans slug extraction (re-exported from service for backward compat)
export { extractFFSlug } from "@/services/festivalfans/client";
