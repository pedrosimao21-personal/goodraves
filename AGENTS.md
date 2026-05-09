# Agents Guide

## Project Overview

Goodraves is a Next.js web app for tracking electronic music festivals/raves, rating DJs, and discovering artists. It uses Neon Postgres with Drizzle ORM, NextAuth for authentication, and integrates with Spotify, Last.fm, and Resident Advisor.

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Database**: Neon Postgres via `@neondatabase/serverless`
- **ORM**: Drizzle ORM + Drizzle Kit
- **Auth**: NextAuth v5 (beta)
- **Language**: TypeScript

## Project Structure

```
src/
├── app/                    # Next.js App Router pages and API routes
│   ├── api/                # REST endpoints (auth, register)
│   ├── artist/[id]/[name]/ # Artist detail page
│   ├── dashboard/          # User dashboard (attended/upcoming)
│   ├── festival/[id]/      # Festival detail page
│   ├── insights/           # User insights/stats
│   ├── timeline/           # Timeline view
│   └── top-djs/            # Top DJs leaderboard
├── components/             # Shared React components
├── context/                # React context (UserDataContext)
├── db/
│   ├── actions/            # Server actions (primary data mutation pattern)
│   ├── index.ts            # DB connection
│   └── schema.ts           # Drizzle schema (source of truth)
├── lib/                    # Utility modules
drizzle/                    # Migration SQL files and metadata
```

## Data Mutation Pattern

The app primarily uses **React Server Actions** (`"use server"`) in `src/db/actions/` rather than API routes. All server actions:

1. Call `requireAuth()` to verify the session
2. Use Drizzle query builder for DB operations
3. Return plain serializable objects

The client uses `UserDataContext` for optimistic updates + server action calls.

## Database Migrations

Migrations are managed with Drizzle Kit. The schema source of truth is `src/db/schema.ts`. Migration SQL files live in `./drizzle/`. Applied migrations are tracked in the `__drizzle_migrations` table.

### Workflow

1. Edit `src/db/schema.ts` with schema changes
2. Generate a migration: `npm run db:generate`
3. Apply pending migrations: `npm run db:migrate`

For complex migrations that can't be auto-generated (e.g. table renames, data backfills), write a SQL file manually in `./drizzle/` and add an entry to `./drizzle/meta/_journal.json`.

**Do not use `drizzle-kit push`** for production changes — always generate and apply migration files so they are tracked.

## Database Schema

Key tables:

| Table | Purpose |
|---|---|
| `users` | User accounts (username + bcrypt password) |
| `festivals` | Festival/event metadata (from RA, custom, or external) |
| `artists` | Artist metadata + Spotify/Last.fm cache |
| `festival_artists` | Lineup join table (festival ↔ artist) |
| `user_festivals` | User attendance/upcoming with rating & notes |
| `user_festival_artist_ratings` | Per-festival artist ratings (saw artist X at festival Y) |
| `user_artist_global` | Overall artist ratings & notes (not tied to a festival) |
| `genres` | Genre names (from Last.fm tags) |
| `artist_genres` | Artist ↔ genre join table |
| `rate_limit_attempts` | Login rate limiting |

## Environment Variables

Required in `.env`:

- `DATABASE_URL` — Neon Postgres connection string
- `AUTH_SECRET` — NextAuth session signing secret
- `LASTFM_KEY` — Last.fm API key
- `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` — Spotify app credentials
