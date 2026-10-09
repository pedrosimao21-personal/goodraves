/**
 * Partyflock splits an event's name into a title ("Awakenings") and an
 * optional subtitle ("Joris Voorn presents Trip To Galaxy"), rendered as
 * `Title · Subtitle`. The subtitle is what tells apart separate parties of
 * the same organiser (each Awakenings ADE party is its own page), so the
 * stored festival name keeps both, joined as `Title: Subtitle`. The colon is
 * the tail separator lib/festival-match.ts already understands: different
 * tails ("Awakenings: Sunday Sessions" vs "Awakenings: Drumcode") never
 * auto-merge, while filler tails like "Day 2" are ignored.
 */

import { decodeHtmlEntities } from "@/utils/text-normalizer";

const TITLE_SUBTITLE_SEPARATOR = ": ";
/** The middot (as entity or character) Partyflock puts before a subtitle. */
const LEADING_MIDDOT = /^\s*(?:&middot;|&#183;|·)\s*/;

/** Decode and trim a raw subtitle fragment, dropping its leading middot. Empty → null. */
export function cleanPFSubtitle(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = decodeHtmlEntities(raw.replace(LEADING_MIDDOT, "")).trim();
  return cleaned || null;
}

/** Join an already-decoded title and subtitle into the stored festival name. */
export function joinPFTitle(title: string, subtitle: string | null): string {
  if (!subtitle) return title;
  if (title.toLowerCase().includes(subtitle.toLowerCase())) return title;
  return `${title}${TITLE_SUBTITLE_SEPARATOR}${subtitle}`;
}
