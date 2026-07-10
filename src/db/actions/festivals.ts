/**
 * Public API for festival-related server actions.
 *
 * This file re-exports the public API from focused submodules:
 *   - festival-search:     DB / RA / FestivalFans search
 *   - festival-data:       getFestival, getFestivalMeta, getFullUserData
 *   - festival-attendance: attendance, ratings, notes, artist toggles
 *   - festival-import:     upsert, batch import, RA/FF fetch & reimport
 *
 * External service clients live in src/services/ (ra, festivalfans, spotify, etc.)
 */

// Search
export { searchFestivalsDB, searchRAEvents, searchFFEvents, searchPFEvents } from "./festival-search";

// Data reads
export { getFestival, getFestivalMeta, getFullUserData, getTimetable } from "./festival-data";
export type { TimetableStage, TimetableSlotRow } from "./festival-data";

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
} from "./festival-import";

// RA import
export { reimportRAEvent, fetchRAEvent, fetchRAEventImageUrl } from "./festival-import-ra";

// FestivalFans import
export { reimportFFEvent, fetchFFEvent, fetchFFEventImageUrl } from "./festival-import-ff";

// B2B split
export { splitB2bArtist, createB2bSet, unsplitB2bSet, rateB2bSet, getB2bSetsForFestival } from "./b2b-split";

// Partyflock import
export { reimportPFEvent, refreshPFEvent, fetchPFEvent, fetchPFEventImageUrl } from "./festival-import-pf";
// Note: the daily agenda importer (festival-import-pf-agenda.ts) and the scheduled refresh
// orchestrator (festival-refresh-pf.ts) are intentionally NOT re-exported here — they are
// server-only cron/script entry points, and this barrel is imported by client components, so
// pulling them in would leak server code into the client bundle.

// Admin re-import (clears and re-fetches lineup from source)
export { reimportFestival } from "./festival-reimport";

// FestivalFans slug extraction (re-exported from service for backward compat)
export { extractFFSlug } from "@/services/festivalfans/client";
