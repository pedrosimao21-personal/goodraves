/**
 * Parser for the Partyflock agenda search results page.
 *
 * The agenda page differs from the text-search page: each event is a
 * schema.org microdata `<tbody itemprop="event">` block carrying its own
 * `startDate` meta and a link that is either `/party/{id}` (a concrete dated
 * party) or `/event/{slug}` (a series — resolved to a numeric id downstream).
 */

import { decodeHtmlEntities } from "@/utils/text-normalizer";

export interface PFAgendaEntry {
  /** Numeric party id, or `event-{slug}` for series links (resolved later). */
  pfId: string;
  name: string;
  /** ISO date (YYYY-MM-DD) taken from the event's schema.org startDate. */
  date: string;
}

const EVENT_BLOCK_RE = /<tbody[^>]*itemprop="event"[^>]*>([\s\S]*?)<\/tbody>/g;
const START_DATE_RE = /itemprop="startDate"\s+content="(\d{4}-\d{2}-\d{2})/;
const ANCHOR_RE = /<a href="\/(party|event)\/([^"?:#]+)/;
const NAME_RE = /itemprop="name">([^<]*)</;

/** Parse the agenda page HTML into a flat list of dated event entries. */
export function parsePFAgendaResults(html: string): PFAgendaEntry[] {
  const entries: PFAgendaEntry[] = [];

  for (const blockMatch of html.matchAll(EVENT_BLOCK_RE)) {
    const block = blockMatch[1];
    const dateMatch = START_DATE_RE.exec(block);
    const anchorMatch = ANCHOR_RE.exec(block);
    if (!dateMatch || !anchorMatch) continue;

    const [, kind, ref] = anchorMatch;
    const pfId = kind === "party" ? ref : `event-${ref}`;
    if (kind === "party" && !/^\d+$/.test(pfId)) continue;

    const nameMatch = NAME_RE.exec(block);
    entries.push({
      pfId,
      name: decodeHtmlEntities((nameMatch?.[1] ?? "").trim()),
      date: dateMatch[1],
    });
  }

  return entries;
}
