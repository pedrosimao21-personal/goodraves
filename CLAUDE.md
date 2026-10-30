# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Goodraves is a Next.js 15 (App Router) web app for discovering electronic music
festivals/raves, tracking attendance, and rating DJs. It enriches event and artist
data from external services (Resident Advisor, FestivalFans, Partyflock, Spotify,
Last.fm, Wikipedia) and caches the results in a Neon Postgres database via Drizzle.

## Commands

```bash
npm run dev          # Dev server
npm run build        # Production build
npm run lint         # ESLint (eslint-config-next). Linting gates merges — run before committing.
npm run db:migrate            # Apply pending migrations (node-pg-migrate, over DATABASE_URL)
npm run db:migrate:down       # Roll back the most recent migration
npm run db:migrate:create -- <name>  # Scaffold migrations/<timestamp>_<name>.sql

# Maintenance scripts (run with tsx; those hitting the DB need DATABASE_URL)
npx tsx scripts/clear-artist-cache.ts               # Clear cached Spotify/Last.fm/RA artist data
npx tsx scripts/cleanup-artist-data.ts [--dry-run]  # Fix encoding/junk artist records
npx tsx --env-file=.env scripts/import-pf-agenda.ts    # Backfill/re-run the daily Partyflock agenda import
npx tsx --env-file=.env scripts/refresh-pf-festivals.ts # Force the Partyflock festival refresh (7-/2-day checkpoints)
npx tsx --env-file=.env.local scripts/link-pf-timetables.ts [--dry-run] # Backfill Partyflock timetables for festivals missing one (all dates)
npx tsx --env-file=.env.local scripts/refresh-timetables.ts [--dry-run]  # Re-sync timetables of festivals in the next 2 weeks (daily cron step)
npx tsx --env-file=.env.local scripts/dedupe-festivals.ts [--dry-run] [--max-merges N] [--abort-above N] # Detect + hard-merge duplicate festivals (daily cron step)
npx tsx --env-file=.env.local scripts/dedupe-lineup-artists.ts [--dry-run] # One-off: merge lineup entries that differ only by accents/punctuation ("Adrián"/"Adrian Mills")
node scripts/generate-brand-icons.mjs  # Regenerate public/icon.svg, favicon.ico and the app/touch icons from the master mark in the script
npx tsx --env-file=.env scripts/repair-pf-merges.ts [--dry-run] # One-off: un-merge separate Partyflock parties, drop stale merge records, add subtitles to names
npx tsx --env-file=.env.local scripts/backfill-festival-countries.ts [--dry-run]   # Backfill country_code/country_name on pre-existing rows
npx tsx --env-file=.env --env-file=.env.local scripts/refresh-spotify-matches.ts [--dry-run] [--limit <n>] # Re-verify stored Spotify artist matches (stamps spotify_verified_at; daily cron step too)
npx tsx --env-file=.env.local scripts/backfill-artist-photos.ts [--dry-run] [--limit <n>] # Give artists a Resident Advisor profile photo, RA first then Spotify (daily cron step too)
npx tsx --env-file=.env.local scripts/backfill-festival-schedules.ts [--dry-run] [--limit <n>] # Re-read RA festivals' days + clock times (overnight parties become one day; rescheduled dates fixed)
```

There is **no test suite** in this repo — do not assume `npm test` exists.

Environment variables (`.env`, see `.env.example`): `AUTH_SECRET`, `DATABASE_URL`,
`LASTFM_KEY`, `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`.

## Git workflow

Commit and push **directly to `main`** — this is the preferred workflow. Do not create a
feature branch or open a pull request unless the user explicitly asks for one. Committing
and pushing still happens only when the user asks.

Push as the personal GitHub account **`MRVDH`**, not the work account `MRVDH-DEPT`. Use the
`/push` command — it switches accounts, commits, pushes, and restores the previous account.
A PreToolUse guard (`.claude/hooks/guard-push-account.sh`) blocks any `git push` while
`MRVDH-DEPT` is the active `gh` account.

## Keeping docs current

When you change code, update the docs it's mirrored in — in the same change. A Stop
hook (`.claude/hooks/check-doc-sync.sh`) reminds you if you miss one.

- Change `src/db/schema.ts` tables/columns → update the schema overview in `README.md`
  and the key-tables list in this file.
- Add/rename/remove a `scripts/` file or an npm script in `package.json` → update the
  Commands block in this file (and `README.md` if it's a user-facing command).
- Add an external image domain → both places in `next.config.ts` (see Conventions).
- Change a coding convention → `AGENTS.md`.
- Store a new kind of personal data, change who can see it, or add a third-party service/embed
  that the browser loads → update `/privacy` (`src/app/privacy/page.tsx`) and bump
  `LEGAL_LAST_UPDATED` in `src/lib/site.ts`. The "no cookie banner" claim there holds only while
  nothing non-essential (analytics, embeds) loads before the user opts in.

Prefer describing code over mirroring it (e.g. point at `schema.ts` rather than
re-listing columns) so there's less to keep in sync.

## Architecture

**Data mutation = Server Actions, not API routes.** The app deliberately avoids REST
endpoints for app data. Mutations and reads live as `"use server"` functions in
`src/db/actions/`. The only API routes (`src/app/api/`) are NextAuth handlers,
registration, and the `cron/` routes (scheduled jobs triggered by Vercel Cron, gated by a
`CRON_SECRET` bearer token — see `vercel.json`: `import-pf-agenda` at 04:00, then
`daily-maintenance` at 06:00 — prune old `rate_limit_counters` rows (they hold IPs), dedupe, timetable re-sync for the next 2 weeks, timetable
auto-link, RA artist photos, Spotify match re-verification; Hobby-plan crons may fire up to 59 min late, hence the gap). Every server action must:
1. Call `requireAuth()` (or `requireAdmin()`) from `festival-helpers.ts` to verify the session.
2. Use the Drizzle query builder against `db` from `src/db/index.ts`.
3. Return plain serializable objects.

**`src/db/actions/festivals.ts` is a curated barrel** — it re-exports the public action
API from focused submodules (`festival-search`, `festival-data`, `festival-attendance`,
`festival-import`, `festival-import-{ra,ff,pf}`, `b2b-split`, etc.). Import app-facing
actions from `@/db/actions/festivals`; the submodules are the implementation.

**External services live in `src/services/<provider>/`** with a `client.ts` (HTTP/GraphQL
calls, raw responses) and usually a `parser.ts` (maps raw responses to app types).
Providers: `ra` (Resident Advisor GraphQL), `festivalfans`, `partyflock`, `spotify`,
`lastfm`, `wikipedia`. Server actions in `db/actions/` orchestrate these clients and
persist results. Keep HTTP/parsing in `services/`; keep DB logic in `db/actions/`.

**Artist enrichment is cached in the DB with staleness windows.** The `artists` table
stores Spotify, Last.fm, and RA data inline as columns (JSON blobs stored as `text`,
e.g. `spotifyAlbums`, `lastfmSimilar`, `raUpcomingEvents`) alongside `*FetchedAt`
timestamps. Refetch only when stale (Spotify ~60 days, Last.fm ~7 days). Don't hit the
external APIs on every render.

**Client state: `UserDataContext`** (`src/context/`) holds the user's festivals/ratings,
does optimistic updates, then calls server actions. The root layout hydrates it
server-side on first load via `user-data-query.ts` (`fetchUserDataForId`), reusing the
userId from the single `auth()` call it makes for the session provider. State-shaping helpers (`transformDbData`, `buildUpsertPayload`)
live in `user-data-state.ts`; read selectors in `use-user-data-readers.ts`.

**Auth:** NextAuth v5 (beta) Credentials provider in `auth.ts` (bcrypt password hashes,
JWT sessions, login rate-limited per IP+username via `rate-limit.ts`). `middleware.ts` protects
`/dashboard/*`. Admin actions are gated by the `users.isAdmin` boolean column, re-checked
against the DB in `requireAdmin()` (`festival-helpers.ts`) on every admin action.

## Database & migrations

Two distinct sources of truth, kept in sync **by hand**:
- **ORM types / queries:** `src/db/schema.ts` (Drizzle ORM query builder over the neon-http
  driver — see `src/db/index.ts`). Deeply embedded across `db/actions/`; unchanged by the
  migration tooling.
- **DDL:** plain-SQL migrations in `./migrations/`, applied with **node-pg-migrate** over
  `node-postgres` against the regular `DATABASE_URL` (run with `--no-lock`). Applied migrations
  tracked in the `pgmigrations` table.

node-pg-migrate gives real transactions over TCP — the fix for drizzle-kit, which was
fundamentally broken here: the app's neon-http driver has no transaction support, so
drizzle-kit's transactional migrator never worked and migrations were applied by hand,
corrupting `__drizzle_migrations` and the old journal. Migrations run with `--no-lock` because
node-pg-migrate's session advisory lock misbehaves over Neon's pooled (PgBouncer) endpoint;
transactions themselves are unaffected, and the lock is unnecessary for manual single-operator
migrations.

Workflow: edit `schema.ts` (ORM types) **and** author a migration
(`npm run db:migrate:create -- <name>`, write DDL under `-- Up Migration` + a real
`-- Down Migration`) → `npm run db:migrate`. plpgsql/triggers/backfills are plain SQL. There is
**no auto-diff** between `schema.ts` and migrations — keep them consistent yourself. See
`migrations/README.md` for the full workflow and the one-time baseline procedure.

Key tables: `festivals` (PK is text like `ra-2403879`; `source` is
`"ra"|"custom"|"external"|"festivalfans"|"partyflock"`; optional `pf_party_id` links to a
Partyflock party for timetable import, independent of `source`; `lineup_checked_at` /
`image_checked_at` gate the on-demand lineup/image backfills in `getFestival`;
`country_code`/`country_name` are populated at import time — see
`src/utils/location-normalizer.ts` — and by `scripts/backfill-festival-countries.ts` for
pre-existing rows; `pf_link_checked_at` throttles the daily cron's Partyflock timetable search),
`artists` (photos: `image_source` is `ra`|`spotify`|`manual`, `image_locked` = an admin fixed it; RA's curated
profile photo is preferred over Spotify's name match and neither replaces a locked one — see
`artist-photo-core.ts` and `artist-image-guard.ts`; `ra_photo_checked_at` / `spotify_verified_at` pace the daily jobs),
`festival_artists` (lineup join), `genres`/`artist_genres` (artist↔genre join),
`festival_genres` (festival↔genre join, from the Partyflock genre estimate),
`user_festivals` (attendance + rating + notes),
`user_festival_artist_ratings` and `user_artist_global` (ratings in half points, 0.5-5, `real`), `user_artist_follows` (followed artists →
`/following`, which reads their upcoming festivals from `festival_artists` only; follows are
visible to friends, never public), `festival_b2b_sets`/`_members`
(splitting back-to-back DJ sets into individuals), `festival_timetable_slots` (per-stage
slots; `slot_date` distinguishes days once a multi-day festival's rows are merged),
`festival_duplicate_candidates` (review queue for the daily dedupe — pairs that weren't certain
enough to auto-merge; resolved on `/admin/duplicates`; dismissed pairs stay so they're never
re-suggested), `festival_merges` (audit trail for the hard-merge dedup in `festival-merge.ts` — old
`/festival/<id>` URLs for a merged-away row redirect via `getMergeRedirectTarget`, and every
importer checks `resolveMergedFestivalId` first so a merged-away id is never re-created),
`festival_lineup_exclusions` (admin "remove from lineup" / "merge duplicate" edits, keyed by the folded artist
name so they survive re-imports; every lineup write goes through `canonicalizeLineupIds` in
`lineup-canonical.ts`, which applies them and collapses same-name spellings within one festival),
`cron_runs` (one row per cron run, written by `recordCronRun` in `cron-runs-core.ts`, which wraps
both cron routes; read by the `/admin` dashboard; pruned after 90 days).

## Conventions

`AGENTS.md` holds the full coding conventions. Enforced hard limits worth remembering: **files ≤ 300 lines**, **functions ≤ 3
levels of nesting**, single-responsibility per file, no magic numbers (extract to
UPPER_SNAKE_CASE constants — many live in `src/lib/constants.ts`), no empty/log-only catch
blocks, verb-first camelCase functions, `is`/`has`/`can`/`should` for booleans. The large
file count in `db/actions/` and `services/` reflects this SRP-by-splitting style — follow it
when adding features rather than growing existing files.

Image domains must be allowlisted in **both** `next.config.ts` `remotePatterns` **and** the
CSP `img-src` header (same file) when adding a new external image source.

## Redesign reference

`docs/redesign/` holds the "Flyer, not dashboard" redesign: tokens, component rules, a
board-per-route map and the behaviour changes it implies (`README.md`), plus the canvas
source per screen (`boards/*.dc.html`, mock data in each file's `renderVals()`). Use it as
the spec when restyling pages; the live canvas link is in the README.