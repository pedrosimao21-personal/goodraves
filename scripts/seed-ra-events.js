#!/usr/bin/env node
/**
 * seed-ra-events.js
 * ─────────────────
 * Converts ra-scraper JSONL output into the app's src/data/ra-events.js
 * static seed file so events are always pre-loaded without any browser upload.
 *
 * Usage:
 *   node scripts/seed-ra-events.js \
 *     --events "C:\...\EventItem.jsonl" \
 *     --lineups "C:\...\EventLineupItem.jsonl"
 *
 * Options:
 *   --events   Path to EventItem.jsonl        (required)
 *   --lineups  Path to EventLineupItem.jsonl  (optional)
 *   --out      Output path (default: src/data/ra-events.js)
 *   --append   Merge with existing static events instead of replacing them
 *   --dry-run  Print stats but don't write the file
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { resolve, dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ─── CLI args ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
function getArg(flag) {
  const i = args.indexOf(flag)
  return i !== -1 && args[i + 1] ? args[i + 1] : null
}
const hasFlag = (flag) => args.includes(flag)

const eventsPath  = getArg('--events')
const lineupsPath = getArg('--lineups')
const outPath     = getArg('--out') || join(__dirname, '..', 'src', 'data', 'ra-events.js')
const dryRun      = hasFlag('--dry-run')
const append      = hasFlag('--append')

if (!eventsPath) {
  console.error('❌  --events <path> is required')
  console.error('    Example: node scripts/seed-ra-events.js --events "EventItem.jsonl" --lineups "EventLineupItem.jsonl"')
  process.exit(1)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Read a .jsonl file and return an array of parsed objects */
function readJsonl(filePath) {
  const abs = resolve(filePath)
  if (!existsSync(abs)) {
    console.error(`❌  File not found: ${abs}`)
    process.exit(1)
  }
  const text = readFileSync(abs, 'utf-8')
  return text
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .map((line, i) => {
      try {
        return JSON.parse(line)
      } catch {
        console.warn(`⚠️  Skipping malformed line ${i + 1}: ${line.slice(0, 80)}…`)
        return null
      }
    })
    .filter(Boolean)
}

/** Try to produce a YYYY-MM-DD string from a variety of date formats */
function normaliseDate(raw) {
  if (!raw) return null
  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10)
  // Try native Date parse (handles "Tue, 31 Dec 2019", "31 Dec 2019", ISO 8601, etc.)
  const d = new Date(raw)
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  return raw // fallback: return as-is
}

/**
 * Extract the best available field value from an object,
 * trying multiple candidate keys in priority order.
 * Supports dot-notation: "venue.name"
 */
function pick(obj, ...keys) {
  for (const k of keys) {
    const parts = k.split('.')
    let v = obj
    for (const p of parts) v = v?.[p]
    if (v !== undefined && v !== null && v !== '') return v
  }
  return undefined
}

/** Derive a unique stable ID from the RA event */
function buildId(item) {
  const raw =
    pick(item, 'id', 'eventId', 'ra_id', 'raId', 'slug') ??
    `${item.title ?? 'event'}-${item.date ?? ''}`.toLowerCase().replace(/\s+/g, '-')
  return `ra-${String(raw).replace(/^ra-/, '')}`
}

// ─── Load files ───────────────────────────────────────────────────────────────

console.log('📂  Reading EventItem.jsonl …')
const eventData = readJsonl(eventsPath)
console.log(`    → ${eventData.length} rows`)

let lineupData = []
if (lineupsPath) {
  console.log('📂  Reading EventLineupItem.jsonl …')
  lineupData = readJsonl(lineupsPath)
  console.log(`    → ${lineupData.length} rows`)
}

// ─── Build lineup map ─────────────────────────────────────────────────────────
// Map from raw event id → string[]
const lineupMap = {}

lineupData.forEach(item => {
  // Common RA scraper schemas for lineup rows:
  //   { eventId, artist }          — one row per artist
  //   { id, lineup: [] }           — one row per event with an array
  //   { event_id, name }           — alternate naming
  //   { eventId, artists: [] }     — array variant
  const eventKey =
    pick(item, 'eventId', 'event_id', 'id', 'raEventId') ?? null
  if (!eventKey) return

  const key = String(eventKey)
  if (!lineupMap[key]) lineupMap[key] = []

  const arr =
    pick(item, 'lineup', 'artists', 'lineup_artists') // array field
  if (Array.isArray(arr)) {
    arr.forEach(a => {
      const name = typeof a === 'string' ? a : pick(a, 'name', 'artistName', 'title')
      if (name) lineupMap[key].push(name)
    })
    return
  }

  // Single artist per row
  const name = pick(item, 'artist', 'name', 'artistName', 'artist_name', 'title')
  if (name) lineupMap[key].push(name)
})

// ─── Normalise events ─────────────────────────────────────────────────────────
const imported = {}
let skipped = 0

eventData.forEach(item => {
  // Raw RA ID (without prefix) used to look up lineup
  const rawId = String(pick(item, 'id', 'eventId', 'ra_id', 'raId', 'slug') ?? '')
  const id = buildId(item)

  const dateRaw = pick(item,
    'date', 'startDate', 'start_date', 'eventDate', 'event_date',
    'date_start', 'dateStart', 'datetime'
  )

  const venueName = pick(item,
    'venue', 'venueName', 'venue_name', 'venue.name', 'location'
  )
  const venueCity = pick(item,
    'city', 'venueCity', 'venue_city', 'venue.city', 'venue.address.city',
    'location.city'
  )
  const link = pick(item,
    'link', 'url', 'contentUrl', 'ra_url', 'href', 'eventUrl'
  )
  const name = pick(item,
    'title', 'name', 'eventTitle', 'event_title', 'eventName'
  )

  if (!name) { skipped++; return }

  // Inline lineup from event row (some scrapers embed it)
  const inlineLineup =
    pick(item, 'lineup', 'artists', 'lineup_artists', 'performers')
  let lineup = lineupMap[rawId] ?? []

  if (!lineup.length && Array.isArray(inlineLineup)) {
    lineup = inlineLineup.map(a =>
      typeof a === 'string' ? a : pick(a, 'name', 'artistName', 'title') ?? ''
    ).filter(Boolean)
  }

  if (!lineup.length) {
    // Some schemas embed artist directly on the event row
    const artist = pick(item, 'artist', 'headliner', 'main_act')
    if (artist) lineup = [artist]
  }

  // Deduplicate artists
  lineup = [...new Set(lineup.map(s => String(s).trim()).filter(Boolean))]

  imported[id] = {
    id,
    name,
    date: normaliseDate(dateRaw),
    venue: {
      name: venueName ?? 'Unknown Venue',
      city: venueCity ?? '',
    },
    lineup,
    link: link ?? null,
    source: 'ra',
  }
})

console.log(`\n✅  Normalised: ${Object.keys(imported).length} events  |  Skipped: ${skipped}  |  Lineup entries: ${lineupData.length}`)

// ─── Optionally merge with existing static events ─────────────────────────────
let finalEvents = imported

if (append) {
  console.log('🔗  --append: merging with existing ra-events.js …')
  try {
    const existingRaw = readFileSync(resolve(outPath), 'utf-8')
    // Extract just the object literal via regex and parse it as JSON-ish
    // (We regenerate the file using JSON-serialisable values so it's safe to eval)
    const match = existingRaw.match(/const RA_STATIC_EVENTS = (\{[\s\S]*?\})\s*\n\s*export default/)
    if (match) {
      // eslint-disable-next-line no-eval
      const existing = eval('(' + match[1] + ')')
      finalEvents = { ...existing, ...imported }
      console.log(`    Merged: ${Object.keys(existing).length} existing + ${Object.keys(imported).length} new = ${Object.keys(finalEvents).length} total`)
    }
  } catch (e) {
    console.warn('⚠️  Could not parse existing ra-events.js for merge, using imported only:', e.message)
  }
}

// ─── Generate output ─────────────────────────────────────────────────────────
const entries = Object.entries(finalEvents)
  .sort(([, a], [, b]) => (a.date ?? '').localeCompare(b.date ?? ''))

const jsonBody = entries
  .map(([key, ev]) => {
    const safeStr = (s) => s != null ? JSON.stringify(String(s)) : 'null'
    const lineupStr = JSON.stringify(ev.lineup ?? [])
    return (
      `  ${JSON.stringify(key)}: {\n` +
      `    id: ${safeStr(ev.id)},\n` +
      `    name: ${safeStr(ev.name)},\n` +
      `    date: ${safeStr(ev.date)},\n` +
      `    venue: { name: ${safeStr(ev.venue?.name)}, city: ${safeStr(ev.venue?.city)} },\n` +
      `    lineup: ${lineupStr},\n` +
      `    link: ${safeStr(ev.link)},\n` +
      `    source: 'ra',\n` +
      `  }`
    )
  })
  .join(',\n')

const output = `/**
 * Pre-seeded Resident Advisor events for the Festival Tracker.
 * Auto-generated by scripts/seed-ra-events.js on ${new Date().toISOString().slice(0, 10)}.
 * Total events: ${entries.length}
 */
const RA_STATIC_EVENTS = {
${jsonBody},
}

export default RA_STATIC_EVENTS
`

if (dryRun) {
  console.log('\n🔎  --dry-run: not writing file.')
  console.log(`    Would write ${entries.length} events to: ${resolve(outPath)}`)
  const preview = entries.slice(0, 3)
  if (preview.length) {
    console.log('\n    Sample entries:')
    preview.forEach(([, ev]) =>
      console.log(`    • ${ev.name} @ ${ev.venue?.name}, ${ev.venue?.city} (${ev.date}) — ${ev.lineup.length} artists`)
    )
  }
  process.exit(0)
}

const outAbs = resolve(outPath)
mkdirSync(dirname(outAbs), { recursive: true })
writeFileSync(outAbs, output, 'utf-8')

console.log(`\n🎉  Written to: ${outAbs}`)
console.log(`    ${entries.length} events ready.  Run "npm run dev" to see them in the app.`)
