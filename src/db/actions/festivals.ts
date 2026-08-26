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
export { searchFestivalsDB, searchRAEvents, searchFFEvents, searchPFEvents, resolvePartyflockSlug } from "./festival-search";

// Fallback card image (gated Spotify/Wikipedia proxy)
export { getFestivalCardImage } from "./festival-card-image";

// Data reads
export { getFestival, getFestivalMeta, getFullUserData } from "./festival-data";
export { getTimetable } from "./festival-timetable";
export type { TimetableStage, TimetableSlotRow, TimetableData } from "./festival-timetable";

// User attendance & ratings
export {
  addAttendance,
  removeAttendance,
  setFestivalNotes,
  rateFestival,
  toggleSawArtist,
  toggleWantToSee,
  rateArtist,
  clearUserFestivals,
  setGlobalArtistRating,
  setGlobalArtistNotes,
  setFestivalPublicComment,
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
export { reimportPFEvent, fetchPFEvent, fetchPFEventImageUrl } from "./festival-import-pf";
// Note: refreshPFEvent/importPFEvent (festival-import-pf-core.ts) and the daily agenda
// importer (festival-import-pf-agenda.ts) / scheduled refresh orchestrator
// (festival-refresh-pf.ts) are intentionally NOT re-exported here — they have no auth
// or rate limiting of their own (see festival-import-pf-core.ts), and this barrel is
// imported by client components, so pulling them in would make them directly callable
// from the client. Unlike festival-import-pf.ts, festival-import-pf-core.ts has no
// "use server" directive at all, so this isn't just a barrel-hygiene convention — an
// app-wide grep for "use server" is enough to audit every real Server Action.

// Admin re-import (clears and re-fetches lineup from source)
export { reimportFestival } from "./festival-reimport";

// Admin Partyflock timetable import (for festivals whose own source has no timetable)
export { importPFTimetableForFestival } from "./festival-timetable-import";
export type { PFTimetableImportResult } from "./festival-timetable-import";

// Admin duplicate-festival merge (hard merge — see festival-merge.ts)
export { mergeFestivals, getMergeRedirectTarget } from "./festival-merge";
export type { MergeResult } from "./festival-merge";
// Note: mergeFestivalsCore is intentionally NOT re-exported here — it skips
// requireAdmin (like importPFTimetable), so only scripts/dedupe-festivals.ts
// should import it directly from ./festival-merge.
