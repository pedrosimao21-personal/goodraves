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
npm run db:generate  # Generate a migration from src/db/schema.ts changes
npm run db:migrate   # Apply pending migrations
npx tsx scripts/seed-db.ts          # Seed festivals from a generated data module (needs DATABASE_URL)
npx tsx scripts/clear-artist-cache.ts  # Clear cached Spotify/Last.fm artist data
npx tsx --env-file=.env scripts/import-pf-agenda.ts  # Manually run the daily Partyflock agenda import (backfill/ad-hoc)
```

There is **no test suite** in this repo — do not assume `npm test` exists.

Environment variables (`.env`, see `.env.example`): `AUTH_SECRET`, `DATABASE_URL`,
`LASTFM_KEY`, `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`.

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
JWT sessions, login rate-limited 10/15min via `rate-limit.ts`). `middleware.ts` protects
`/dashboard/*`. Admin actions are gated by username allowlist `ADMIN_USERNAMES` in
`src/lib/constants.ts`.

## Database & migrations

Schema source of truth: `src/db/schema.ts`. Migration SQL lives in `./drizzle/`; applied
migrations tracked in `__drizzle_migrations`. Workflow: edit schema → `npm run db:generate`
→ `npm run db:migrate`. For renames/backfills that can't auto-generate, hand-write the SQL
in `./drizzle/` and add an entry to `./drizzle/meta/_journal.json`.

**Do not use `drizzle-kit push` for production changes** — always generate tracked migration files.

Key tables: `festivals` (PK is text like `ra-2403879`; `source` is `"ra"|"custom"|"external"`),
`artists`, `festival_artists` (lineup join), `user_festivals` (attendance + rating + notes),
`user_festival_artist_ratings`, `user_artist_global`, `festival_b2b_sets`/`_members`
(splitting back-to-back DJ sets into individuals), `festival_timetable_slots`.

## Conventions

`AGENTS.md` is the authoritative coding constitution and takes precedence over informal
style. Enforced hard limits worth remembering: **files ≤ 300 lines**, **functions ≤ 3
levels of nesting**, single-responsibility per file, no magic numbers (extract to
UPPER_SNAKE_CASE constants — many live in `src/lib/constants.ts`), no empty/log-only catch
blocks, verb-first camelCase functions, `is`/`has`/`can`/`should` for booleans. The large
file count in `db/actions/` and `services/` reflects this SRP-by-splitting style — follow it
when adding features rather than growing existing files.

Image domains must be allowlisted in **both** `next.config.ts` `remotePatterns` **and** the
CSP `img-src` header (same file) when adding a new external image source.