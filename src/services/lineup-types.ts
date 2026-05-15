/**
 * Shared types for parsed lineup entries across all import sources.
 */

export type SoloLineupEntry = {
  type: "solo";
  name: string;
};

export type B2bLineupEntry = {
  type: "b2b";
  /** Display name preserving the original connector and any suffixes. */
  originalName: string;
  /** Individual artist names in performance order. */
  members: string[];
};

export type LineupEntry = SoloLineupEntry | B2bLineupEntry;

/** Extract all unique artist names from a list of lineup entries. */
export function flattenLineupNames(entries: LineupEntry[]): string[] {
  const seen = new Set<string>();
  const names: string[] = [];

  for (const entry of entries) {
    const entryNames = entry.type === "solo" ? [entry.name] : entry.members;
    for (const name of entryNames) {
      if (!seen.has(name)) {
        seen.add(name);
        names.push(name);
      }
    }
  }

  return names;
}

/** Filter lineup entries to only b2b entries. */
export function filterB2bEntries(entries: LineupEntry[]): B2bLineupEntry[] {
  return entries.filter((e): e is B2bLineupEntry => e.type === "b2b");
}

/**
 * Regex matching common B2B connectors between artist names/links.
 * Matches: "b2b", "B2B", "x", "&", "&amp;", "vs", "vs."
 */
export const B2B_CONNECTOR_PATTERN = /^\s*(?:x|&(?:amp;)?|vs\.?|b2b)\s*$/i;
