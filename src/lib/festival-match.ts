/**
 * Pure rules for "are these two festival rows the same real-world event?",
 * used by the daily dedupe (db/actions/festival-dedupe-core.ts). No DB access.
 *
 * Several independent signals are combined, because on the live data no
 * single one is reliable on its own:
 *  - names differ across sources ("VELD 2026" vs "VELD Music Festival"; RA
 *    often appends the lineup: "Watergate Open Air with Anfisa Letyago, …")
 *  - a lineup overlap alone is fooled by small, same-city, same-weekend
 *    events ("Dockyard" vs "Mystic Garden" share every artist of the smaller
 *    lineup)
 *  - the same brand runs separate side events ("Soenda Festival" vs "Soenda
 *    Festival After Hours") that must never merge.
 * So there are hard rule-outs (dates, place, event type) and then evidence
 * (name, lineup, shared Partyflock page), graded into auto-merge / review.
 */

export type MatchRow = {
  id: string;
  name: string;
  date: string;
  endDate: string | null;
  location: string | null;
  venue: string | null;
  latitude: number | null;
  longitude: number | null;
  pfPartyId: string | null;
  artistIds: Set<string>;
};

export type PairVerdict = { verdict: "auto" | "review" | "none"; reason: string };

const DATE_SLACK_DAYS = 1;
const MAX_SAME_PLACE_KM = 3;
const MIN_COMPARABLE_LINEUP = 5;
const LINEUP_AGREES = 0.6;
const LINEUP_CONTRADICTS = 0.2;
const LINEUP_SAME_EVENT = 0.8;
const MIN_SHARED_FOR_LINEUP_ONLY = 8;
const MIN_CONTAINED_CORE_CHARS = 4;
const NAME_SIMILAR_JACCARD = 0.7;
const TAILS_DIFFER_JACCARD = 0.5;
const PF_BATCH_MAX_ID_GAP = 20;
const EARTH_RADIUS_KM = 6371;
const MS_PER_DAY = 86_400_000;

/** A side event of a brand, never the main event itself. */
const MARKER_WORDS = new Set([
  "after", "afterparty", "afterparties", "afters", "preparty", "pre", "warmup", "kickoff",
  "aftershow", "afterhours", "opening", "closing", "indoor", "upclose", "special", "night", "bus", "shuttle",
  "ticket", "tickets", "camping", "boat", "brunch",
]);
/** Words that say nothing about WHICH event it is. */
const NOISE_WORDS = new Set([
  "festival", "fest", "music", "official", "edition", "presents", "pres", "the", "de", "het",
  "of", "and", "en", "x", "promo", "discount", "code", "day", "days",
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
  "january", "february", "march", "april", "may", "june", "july", "august",
  "september", "october", "november", "december",
]);
/** Everything after one of these is usually a lineup or promo tail, not the name. */
const NAME_TAIL_SEPARATORS = /\s[-–—|]\s|:|\s(?:with|w\/|feat\.?|ft\.?)\s/i;
const SHORT_NUMBER_OR_YEAR = /^(\d{1,2}|(19|20)\d{2})$/;
const INVALID_CITY_VALUES = new Set(["all"]);

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(text: string): string[] {
  return normalizeText(text).split(" ").filter(Boolean);
}

export function markerSet(name: string): Set<string> {
  return new Set(tokens(name).filter((t) => MARKER_WORDS.has(t)));
}

function meaningfulTokens(text: string): Set<string> {
  return new Set(
    tokens(text).filter((t) => !NOISE_WORDS.has(t) && !MARKER_WORDS.has(t) && !SHORT_NUMBER_OR_YEAR.test(t))
  );
}

/** The identifying part of a name: no lineup tail, years, dates, or filler words. */
export function coreTokens(name: string): Set<string> {
  return meaningfulTokens(name.split(NAME_TAIL_SEPARATORS)[0] ?? name);
}

/** What follows the first tail separator ("fabric: giegling - Cassy, …" → "giegling cassy …"). */
function tailTokens(name: string): Set<string> {
  const match = NAME_TAIL_SEPARATORS.exec(name);
  return match ? meaningfulTokens(name.slice(match.index + match[0].length)) : new Set();
}

/** Core name with spacing ignored, so "KappaFuturFestival" ~ "Kappa Futur Festival". */
function squash(parts: Set<string>): string {
  return [...parts].join("").replace(/festival/g, "");
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared++;
  return shared / (a.size + b.size - shared);
}

function isSubset(small: Set<string>, large: Set<string>): boolean {
  for (const t of small) if (!large.has(t)) return false;
  return true;
}

type NameEvidence = "exact" | "similar" | "contains" | "none";

export function compareNames(a: string, b: string): NameEvidence {
  const ca = coreTokens(a);
  const cb = coreTokens(b);
  if (ca.size === 0 || cb.size === 0) return "none";
  // Same prefix but clearly different events after it — typically a club
  // or promoter prefix: "fabric: Agents Of Time" vs "fabric: giegling".
  const ta = tailTokens(a);
  const tb = tailTokens(b);
  if (ta.size > 0 && tb.size > 0 && jaccard(ta, tb) < TAILS_DIFFER_JACCARD) return "none";
  if ((ca.size === cb.size && isSubset(ca, cb)) || (squash(ca) && squash(ca) === squash(cb))) return "exact";
  if (jaccard(ca, cb) >= NAME_SIMILAR_JACCARD) return "similar";
  const [small, large] = ca.size <= cb.size ? [ca, cb] : [cb, ca];
  const smallChars = [...small].join("").length;
  if (smallChars >= MIN_CONTAINED_CORE_CHARS && isSubset(small, large)) return "contains";
  return "none";
}

function cityKey(location: string | null): string | null {
  const first = location?.split(",")[0]?.trim();
  if (!first) return null;
  const key = normalizeText(first);
  return key && !INVALID_CITY_VALUES.has(key) ? key : null;
}

function distanceKm(a: MatchRow, b: MatchRow): number | null {
  if (a.latitude === null || a.longitude === null || b.latitude === null || b.longitude === null) return null;
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** Same city (either containing the other: "Dortmund / Essen" ~ "Dortmund"), same venue, or ≤3 km apart. */
export function isSamePlace(a: MatchRow, b: MatchRow): boolean {
  const cityA = cityKey(a.location);
  const cityB = cityKey(b.location);
  if (cityA && cityB) {
    const [small, large] = cityA.length <= cityB.length ? [cityA, cityB] : [cityB, cityA];
    if (isSubset(new Set(small.split(" ")), new Set(large.split(" ")))) return true;
  }
  const venueA = a.venue ? normalizeText(a.venue) : "";
  const venueB = b.venue ? normalizeText(b.venue) : "";
  if (venueA && venueA === venueB) return true;
  const km = distanceKm(a, b);
  return km !== null && km <= MAX_SAME_PLACE_KM;
}

function dayNumber(isoDate: string): number {
  return Math.round(new Date(`${isoDate}T00:00:00Z`).getTime() / MS_PER_DAY);
}

export function datesOverlap(a: MatchRow, b: MatchRow, slackDays: number): boolean {
  const aStart = dayNumber(a.date);
  const aEnd = dayNumber(a.endDate ?? a.date);
  const bStart = dayNumber(b.date);
  const bEnd = dayNumber(b.endDate ?? b.date);
  return aStart <= bEnd + slackDays && bStart <= aEnd + slackDays;
}

/**
 * A listing named after its venue ("Thuishaven" at "Thuishaven terrein",
 * "Hafen49" at "Hafen 49") is a night at that venue, not a festival brand —
 * the same venue name on consecutive days is two different parties
 * (unless Partyflock created them as one multi-day batch — Sziget is named
 * after its island).
 */
function isNamedAfterVenue(row: MatchRow): boolean {
  const name = squash(coreTokens(row.name));
  const venue = row.venue ? squash(meaningfulTokens(row.venue)) : "";
  return name.length > 0 && venue.includes(name);
}

/**
 * Partyflock creates a multi-day festival's per-day pages together, so they
 * get (near-)consecutive ids: Sziget is pf-485517 … pf-485521. Separate
 * nights at one venue are created independently, far apart.
 */
function isSamePartyflockBatch(a: MatchRow, b: MatchRow): boolean {
  const num = (r: MatchRow) => (/^pf-\d+$/.test(r.id) ? Number(r.id.slice(3)) : NaN);
  const gap = Math.abs(num(a) - num(b));
  return Number.isFinite(gap) && gap <= PF_BATCH_MAX_ID_GAP;
}

/**
 * Both rows are Partyflock pages and only one name carries a subtitle tail
 * ("Intercell" vs "Intercell: Fumi Invites" — see services/partyflock/title.ts).
 * Partyflock gives each separate party of one organiser its own subtitle, so
 * this is evidence of two parties. Limited to Partyflock pairs: an RA name's
 * tail is usually a lineup list, not a subtitle.
 */
function hasPartyflockSubtitleMismatch(a: MatchRow, b: MatchRow): boolean {
  const isPf = (r: MatchRow) => /^pf-\d+$/.test(r.id);
  if (!isPf(a) || !isPf(b)) return false;
  return (tailTokens(a.name).size > 0) !== (tailTokens(b.name).size > 0);
}

function sameSets(a: Set<string>, b: Set<string>): boolean {
  return a.size === b.size && isSubset(a, b);
}

function sharesPartyflockPage(a: MatchRow, b: MatchRow): boolean {
  const pagesOf = (r: MatchRow) => [r.pfPartyId, r.id.startsWith("pf-") ? r.id.slice(3) : null].filter(Boolean);
  const pagesA = pagesOf(a);
  return pagesOf(b).some((p) => pagesA.includes(p));
}

type LineupEvidence = { comparable: boolean; overlap: number; shared: number };

function compareLineups(a: MatchRow, b: MatchRow): LineupEvidence {
  let shared = 0;
  const [small, large] = a.artistIds.size <= b.artistIds.size ? [a.artistIds, b.artistIds] : [b.artistIds, a.artistIds];
  for (const id of small) if (large.has(id)) shared++;
  return {
    comparable: small.size >= MIN_COMPARABLE_LINEUP,
    overlap: small.size === 0 ? 0 : shared / small.size,
    shared,
  };
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

export function classifyPair(a: MatchRow, b: MatchRow): PairVerdict {
  if (!datesOverlap(a, b, DATE_SLACK_DAYS)) return { verdict: "none", reason: "dates" };
  if (sharesPartyflockPage(a, b)) return { verdict: "auto", reason: "same Partyflock page" };
  if (!isSamePlace(a, b)) return { verdict: "none", reason: "place" };
  if (!sameSets(markerSet(a.name), markerSet(b.name))) return { verdict: "none", reason: "event type" };

  const sameDay = datesOverlap(a, b, 0);
  if (!sameDay && !isSamePartyflockBatch(a, b) && (isNamedAfterVenue(a) || isNamedAfterVenue(b))) {
    return { verdict: "none", reason: "separate nights at a venue" };
  }
  const name = compareNames(a.name, b.name);
  const lineup = compareLineups(a, b);
  const lineupNote = lineup.comparable ? `lineup overlap ${pct(lineup.overlap)}` : "lineup not comparable";
  if (name !== "none" && hasPartyflockSubtitleMismatch(a, b)) {
    return { verdict: "review", reason: `name ${name} but only one Partyflock page has a subtitle, ${lineupNote}` };
  }
  // "contains" alone is only trusted on the same day: on consecutive days a
  // shared brand ("Verknipt" / "Verknipt ADE") is often a different night.
  const strongName = name === "exact" || name === "similar" || (name === "contains" && sameDay);

  if (strongName) {
    if (sameDay && lineup.comparable && lineup.overlap < LINEUP_CONTRADICTS) {
      return { verdict: "review", reason: `names match (${name}) but ${lineupNote}` };
    }
    return { verdict: "auto", reason: `name ${name}, same place, ${lineupNote}` };
  }
  if (name === "contains") {
    return lineup.comparable && lineup.overlap >= LINEUP_AGREES
      ? { verdict: "auto", reason: `name contains + ${lineupNote} on consecutive days` }
      : { verdict: "review", reason: `name contains, consecutive days, ${lineupNote}` };
  }
  if (lineup.comparable && lineup.overlap >= LINEUP_SAME_EVENT && lineup.shared >= MIN_SHARED_FOR_LINEUP_ONLY) {
    return { verdict: "review", reason: `different names but ${lineupNote} (${lineup.shared} shared artists)` };
  }
  return { verdict: "none", reason: "no evidence" };
}
