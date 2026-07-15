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

Prefer describing code over mirroring it (e.g. point at `schema.ts` rather than
re-listing columns) so there's less to keep in sync.

## Architecture

**Data mutation = Server Actions, not API routes.** The app deliberately avoids REST
endpoints for app data. Mutations and reads live as `"use server"` functions in
`src/db/actions/`. The only API routes (`src/app/api/`) are NextAuth handlers,
registration, and the `cron/` routes (scheduled jobs triggered by Vercel Cron, gated by a
`CRON_SECRET` bearer token — see `vercel.json`). Every server action must:
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
does optimistic updates, then calls server actions. `get-initial-data.ts` hydrates it
server-side on first load. State-shaping helpers (`transformDbData`, `buildUpsertPayload`)
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
`"ra"|"custom"|"external"|"festivalfans"|"partyflock"`),
`artists`, `festival_artists` (lineup join), `user_festivals` (attendance + rating + notes),
`user_festival_artist_ratings`, `user_artist_global`, `festival_b2b_sets`/`_members`
(splitting back-to-back DJ sets into individuals), `festival_timetable_slots`.

## Conventions

`AGENTS.md` holds the full coding conventions. Enforced hard limits worth remembering: **files ≤ 300 lines**, **functions ≤ 3
levels of nesting**, single-responsibility per file, no magic numbers (extract to
UPPER_SNAKE_CASE constants — many live in `src/lib/constants.ts`), no empty/log-only catch
blocks, verb-first camelCase functions, `is`/`has`/`can`/`should` for booleans. The large
file count in `db/actions/` and `services/` reflects this SRP-by-splitting style — follow it
when adding features rather than growing existing files.

Image domains must be allowlisted in **both** `next.config.ts` `remotePatterns` **and** the
CSP `img-src` header (same file) when adding a new external image source.