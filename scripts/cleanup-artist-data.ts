/**
 * Data cleanup script for artist records with encoding issues and junk data.
 *
 * Categories handled:
 * 1. HTML entity-encoded names (from FF parser) — decode and merge/rename
 * 2. Time-prefixed names (from RA parser) — strip prefix and merge/rename
 * 3. Full lineup strings stored as single artist — delete
 * 4. Raw <artist> tags stored as names — extract name and merge/rename
 * 5. Pure junk entries (punctuation, modifiers, stage headers) — delete
 *
 * Usage: npx tsx scripts/cleanup-artist-data.ts [--dry-run]
 */

export {};

const DRY_RUN = process.argv.includes("--dry-run");

/** Time-range prefix pattern (e.g. "01:00 - 03:00 ", "12:00-14:00 | ", "20:00 - 22:00: ") */
const TIME_PREFIX_PATTERN = /^\d{2}:\d{2}\s*[-–]\s*\d{2}:\d{2}\s*[:|]?\s*/;

/** Entries that are pure time-only (no artist name after) */
const TIME_ONLY_PATTERN = /^\d{2}:\d{2}\s*[-–]\s*\d{2}:\d{2}\s*[:|]?\s*$/;

/** Raw <artist> tag pattern */
const RAW_ARTIST_TAG_PATTERN = /^<artist\s+id="\d+"[^>]*>(.*?)<\/artist>$/;

/** Junk patterns — entries that are not valid artist names */
const JUNK_PATTERNS = [
  /^[&,!|.:\-–\s]+$/,                   // Pure punctuation/separators
  /^\((?:LIVE|DJ SET|HYBRID|PA)\)$/i,   // Modifiers without a name
  /^& Post$/i,                           // Common junk
  /.*\t.*/,                              // Tab-separated (stage headers)
  /^(?:TBA|TBC|and more\.{0,3})$/i,     // Placeholders
];

/** HTML entity decoding (matches shared utility) */
const NAMED_ENTITIES = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'",
  nbsp: "\u00A0", ndash: "\u2013", mdash: "\u2014",
  laquo: "\u00AB", raquo: "\u00BB",
  lsquo: "\u2018", rsquo: "\u2019",
  ldquo: "\u201C", rdquo: "\u201D",
  Agrave: "\u00C0", Aacute: "\u00C1", Acirc: "\u00C2",
  Atilde: "\u00C3", Auml: "\u00C4", Aring: "\u00C5",
  AElig: "\u00C6", Ccedil: "\u00C7",
  Egrave: "\u00C8", Eacute: "\u00C9", Ecirc: "\u00CA", Euml: "\u00CB",
  Igrave: "\u00CC", Iacute: "\u00CD", Icirc: "\u00CE", Iuml: "\u00CF",
  ETH: "\u00D0", Ntilde: "\u00D1",
  Ograve: "\u00D2", Oacute: "\u00D3", Ocirc: "\u00D4",
  Otilde: "\u00D5", Ouml: "\u00D6", Oslash: "\u00D8",
  Ugrave: "\u00D9", Uacute: "\u00DA", Ucirc: "\u00DB", Uuml: "\u00DC",
  Yacute: "\u00DD", THORN: "\u00DE", szlig: "\u00DF",
  agrave: "\u00E0", aacute: "\u00E1", acirc: "\u00E2",
  atilde: "\u00E3", auml: "\u00E4", aring: "\u00E5",
  aelig: "\u00E6", ccedil: "\u00E7",
  egrave: "\u00E8", eacute: "\u00E9", ecirc: "\u00EA", euml: "\u00EB",
  igrave: "\u00EC", iacute: "\u00ED", icirc: "\u00EE", iuml: "\u00EF",
  eth: "\u00F0", ntilde: "\u00F1",
  ograve: "\u00F2", oacute: "\u00F3", ocirc: "\u00F4",
  otilde: "\u00F5", ouml: "\u00F6", oslash: "\u00F8",
  ugrave: "\u00F9", uacute: "\u00FA", ucirc: "\u00FB", uuml: "\u00FC",
  yacute: "\u00FD", thorn: "\u00FE", yuml: "\u00FF",
};

function decodeHtmlEntities(text: string): string {
  return text.replace(
    /&(?:#(\d+)|#x([0-9a-fA-F]+)|(\w+));/g,
    (match, decimal, hex, named) => {
      if (decimal) return String.fromCodePoint(parseInt(decimal, 10));
      if (hex) return String.fromCodePoint(parseInt(hex, 16));
      if (named && NAMED_ENTITIES[named]) return NAMED_ENTITIES[named];
      return match;
    }
  );
}

function hasHtmlEntities(text: string): boolean {
  return /&(?:#\d+|#x[0-9a-fA-F]+|\w+);/.test(text);
}

function isJunkEntry(name: string): boolean {
  if (name.length === 0) return true;
  if (name.length > 200) return true;
  if (TIME_ONLY_PATTERN.test(name)) return true;
  return JUNK_PATTERNS.some((p) => p.test(name));
}

type CleanupAction =
  | { type: "rename"; id: string; oldName: string; newName: string }
  | { type: "merge"; sourceId: string; sourceName: string; targetId: string; targetName: string }
  | { type: "delete"; id: string; name: string; reason: string };

async function main() {
  const { db } = await import("../src/db/index.js");
  const schema = await import("../src/db/schema.js");
  const { eq, sql } = await import("drizzle-orm");

  const prefix = DRY_RUN ? "[DRY RUN] " : "";
  console.log(`${prefix}Starting artist data cleanup...`);

  // Load all artists
  const allArtists = await db
    .select({ id: schema.artists.id, name: schema.artists.name })
    .from(schema.artists);

  console.log(`Total artists in DB: ${allArtists.length}`);

  // Build a lookup map: lowercase name → { id, name }
  const artistByLower = new Map<string, { id: string; name: string }>();
  for (const artist of allArtists) {
    artistByLower.set(artist.name.toLowerCase(), artist);
  }

  const actions: CleanupAction[] = [];

  for (const artist of allArtists) {
    const { id, name } = artist;

    // Category 5: Pure junk entries
    if (isJunkEntry(name)) {
      actions.push({ type: "delete", id, name, reason: "junk entry" });
      continue;
    }

    // Category 4: Raw <artist> tags stored as names
    const tagMatch = name.match(RAW_ARTIST_TAG_PATTERN);
    if (tagMatch) {
      const extracted = tagMatch[1].trim();
      if (!extracted || isJunkEntry(extracted)) {
        actions.push({ type: "delete", id, name, reason: "empty artist tag" });
        continue;
      }
      const target = artistByLower.get(extracted.toLowerCase());
      if (target && target.id !== id) {
        actions.push({ type: "merge", sourceId: id, sourceName: name, targetId: target.id, targetName: target.name });
      } else {
        actions.push({ type: "rename", id, oldName: name, newName: extracted });
      }
      continue;
    }

    // Category 2: Time-prefixed names
    if (TIME_PREFIX_PATTERN.test(name)) {
      const cleaned = name.replace(TIME_PREFIX_PATTERN, "").trim();
      if (!cleaned || isJunkEntry(cleaned)) {
        actions.push({ type: "delete", id, name, reason: "time-only or junk after strip" });
        continue;
      }
      const target = artistByLower.get(cleaned.toLowerCase());
      if (target && target.id !== id) {
        actions.push({ type: "merge", sourceId: id, sourceName: name, targetId: target.id, targetName: target.name });
      } else {
        actions.push({ type: "rename", id, oldName: name, newName: cleaned });
      }
      continue;
    }

    // Category 1: HTML entity-encoded names
    if (hasHtmlEntities(name)) {
      const decoded = decodeHtmlEntities(name).trim();
      if (decoded === name) continue; // No actual change
      if (!decoded || isJunkEntry(decoded)) {
        actions.push({ type: "delete", id, name, reason: "junk after entity decode" });
        continue;
      }
      const target = artistByLower.get(decoded.toLowerCase());
      if (target && target.id !== id) {
        actions.push({ type: "merge", sourceId: id, sourceName: name, targetId: target.id, targetName: target.name });
      } else {
        actions.push({ type: "rename", id, oldName: name, newName: decoded });
      }
      continue;
    }

    // Category 3: Full lineup strings (multiple artists in one name)
    // Heuristic: contains comma-separated or pipe-separated list of 4+ names
    const commaCount = (name.match(/,/g) || []).length;
    const pipeCount = (name.match(/\|/g) || []).length;
    if (commaCount >= 3 || pipeCount >= 3) {
      actions.push({ type: "delete", id, name, reason: "full lineup string" });
      continue;
    }
  }

  // Summary
  const renames = actions.filter((a) => a.type === "rename");
  const merges = actions.filter((a) => a.type === "merge");
  const deletes = actions.filter((a) => a.type === "delete");

  console.log(`\nPlanned actions:`);
  console.log(`  Renames: ${renames.length}`);
  console.log(`  Merges:  ${merges.length}`);
  console.log(`  Deletes: ${deletes.length}`);
  console.log(`  Total:   ${actions.length}\n`);

  // Log details
  for (const action of renames) {
    if (action.type === "rename") {
      console.log(`  RENAME: "${action.oldName}" → "${action.newName}"`);
    }
  }
  for (const action of merges) {
    if (action.type === "merge") {
      console.log(`  MERGE:  "${action.sourceName}" → "${action.targetName}" (id: ${action.targetId})`);
    }
  }
  for (const action of deletes) {
    if (action.type === "delete") {
      console.log(`  DELETE:  "${action.name}" (${action.reason})`);
    }
  }

  if (DRY_RUN) {
    console.log(`\n${prefix}No changes made. Remove --dry-run to execute.`);
    return;
  }

  // Execute actions
  console.log(`\nExecuting...`);

  let successCount = 0;
  let errorCount = 0;

  for (const action of actions) {
    try {
      if (action.type === "rename") {
        await db
          .update(schema.artists)
          .set({ name: action.newName })
          .where(eq(schema.artists.id, action.id));
        successCount++;
      } else if (action.type === "merge") {
        await mergeAndDelete(db, schema, eq, sql, action.sourceId, action.targetId);
        successCount++;
      } else if (action.type === "delete") {
        await deleteArtistWithRefs(db, schema, eq, action.id);
        successCount++;
      }
    } catch (err) {
      errorCount++;
      const label = action.type === "merge" ? action.sourceName : action.type === "rename" ? action.oldName : action.name;
      console.error(`  ERROR (${action.type}) "${label}": ${err instanceof Error ? err.message : err}`);
    }
  }

  console.log(`\nDone. Success: ${successCount}, Errors: ${errorCount}`);
}

/**
 * Re-point all FK references from sourceId to targetId, then delete the source artist.
 * Handles conflicts by deleting conflicting source rows (target already covers them).
 */
async function mergeAndDelete(
  db: any,
  schema: any,
  eq: any,
  sql: any,
  sourceId: string,
  targetId: string
): Promise<void> {
  const tables = [
    { table: schema.festivalArtists, column: "artistId" },
    { table: schema.userFestivalArtistRatings, column: "artistId" },
    { table: schema.festivalB2bSetMembers, column: "artistId" },
    { table: schema.userArtistGlobal, column: "artistId" },
    { table: schema.artistGenres, column: "artistId" },
    { table: schema.festivalTimetableSlots, column: "artistId" },
  ];

  for (const { table, column } of tables) {
    try {
      await db
        .update(table)
        .set({ [column]: targetId })
        .where(eq(table[column], sourceId));
    } catch {
      // Conflict: target already has matching rows — just delete source rows
      await db.delete(table).where(eq(table[column], sourceId));
    }
  }

  // Delete the now-orphaned source artist
  await db.delete(schema.artists).where(eq(schema.artists.id, sourceId));
}

/**
 * Delete an artist and all its FK references.
 * festival_artists uses ON DELETE restrict, so we must remove refs first.
 */
async function deleteArtistWithRefs(
  db: any,
  schema: any,
  eq: any,
  artistId: string
): Promise<void> {
  // Delete from tables with restrict/no-cascade first
  await db.delete(schema.festivalArtists).where(eq(schema.festivalArtists.artistId, artistId));
  await db.delete(schema.userFestivalArtistRatings).where(eq(schema.userFestivalArtistRatings.artistId, artistId));
  await db.delete(schema.festivalB2bSetMembers).where(eq(schema.festivalB2bSetMembers.artistId, artistId));
  await db.delete(schema.artistGenres).where(eq(schema.artistGenres.artistId, artistId));
  // These cascade but explicit delete is cleaner
  await db.delete(schema.festivalTimetableSlots).where(eq(schema.festivalTimetableSlots.artistId, artistId));
  await db.delete(schema.userArtistGlobal).where(eq(schema.userArtistGlobal.artistId, artistId));
  // Finally delete the artist
  await db.delete(schema.artists).where(eq(schema.artists.id, artistId));
}

main().catch(console.error).finally(() => process.exit(0));
