# Goodraves

A web app for discovering electronic music festivals and raves, tracking what you've attended, and rating the DJs you saw. Festival and artist data is enriched from Resident Advisor, FestivalFans, Partyflock, Spotify, Last.fm, and Wikipedia.

## Getting Started

### Prerequisites

- Node.js with npm
- A [Neon Postgres](https://neon.tech) database

### Environment Variables

Copy `.env.example` to `.env` and fill in the values:

| Variable | Purpose |
|---|---|
| `AUTH_SECRET` | NextAuth session signing secret (generate with `openssl rand -base64 32`) |
| `DATABASE_URL` | Neon Postgres connection string |
| `LASTFM_KEY` | Last.fm API key (from https://www.last.fm/api/account/create) |
| `SPOTIFY_CLIENT_ID` | Spotify app client ID (from https://developer.spotify.com/dashboard) |
| `SPOTIFY_CLIENT_SECRET` | Spotify app client secret |

### Running the Project

```bash
npm install
npm run dev          # Start dev server
npm run build        # Production build
npm run start        # Start production server
npm run lint         # Run ESLint
npm run db:migrate            # Apply pending migrations
npm run db:migrate:create -- <name>  # Scaffold a new SQL migration
```

### Populating Data

Festival and artist data is ingested through the import server actions in
`src/db/actions/` (Resident Advisor, FestivalFans, Partyflock), driven from the app
UI and the Partyflock agenda cron (`vercel.json`). For a manual backfill or ad-hoc run:

```bash
npx tsx --env-file=.env scripts/import-pf-agenda.ts     # Partyflock agenda backfill
npx tsx --env-file=.env scripts/refresh-pf-festivals.ts # Refresh imported Partyflock festivals
```

## Migrations

Migrations are managed with [node-pg-migrate](https://salsita.github.io/node-pg-migrate/).
Drizzle ORM (`src/db/schema.ts`) remains the query/type layer, but DDL lives as plain-SQL
migrations in `./migrations/`, applied over `node-postgres` against the regular `DATABASE_URL`
(run with `--no-lock`, giving real transactions over the pooled Neon endpoint). Applied
migrations are tracked in the `pgmigrations` table. See [`migrations/README.md`](./migrations/README.md)
for details, including the one-time baseline procedure.

### Creating a Migration

Update `src/db/schema.ts` (ORM types) and scaffold a matching SQL migration:

```bash
npm run db:migrate:create -- <name>
```

Write DDL under `-- Up Migration` and a real `-- Down Migration`. Raw SQL — plpgsql functions,
triggers, data backfills — is fully supported. There is no auto-diff between `schema.ts` and
migrations; keep them in sync by hand.

### Running Migrations

```bash
npm run db:migrate       # Apply pending migrations (up)
npm run db:migrate:down  # Roll back the most recent migration
```

## Database Schema

`src/db/schema.ts` is the source of truth for columns and types. Overview of the tables:

| Table | Purpose |
|---|---|
| `users` | Accounts — username, bcrypt `password_hash`, optional `city`/`favorite_genres`, `is_admin` flag |
| `festivals` | Festivals/events (PK is text like `ra-2403879`). `source` is `"ra"`, `"custom"`, `"external"`, `"festivalfans"`, or `"partyflock"`. Includes Partyflock `interested_count`/`visitors_count` |
| `artists` | Artists with inline-cached enrichment: Spotify (stale after 60 days), Last.fm (7 days), Resident Advisor, plus country. JSON blobs stored as `text` alongside `*_fetched_at` timestamps |
| `genres` / `artist_genres` | Normalized genres (from Last.fm tags) and the artist↔genre join |
| `festival_genres` | Festival↔genre join (from the Partyflock genre estimate) |
| `festival_artists` | Lineup join between festivals and artists |
| `festival_b2b_sets` / `festival_b2b_set_members` | Back-to-back sets split into their individual member artists |
| `festival_timetable_slots` | Per-stage timetable slots (stage, start/end time, ordering) |
| `user_festivals` | A user's attendance/interest, with optional `rating` and `notes` |
| `user_festival_artist_ratings` | Per-festival, per-artist performance ratings |
| `user_artist_global` | A user's overall rating/notes for an artist |
| `rate_limit_attempts` | Login rate limiting (10 attempts / 15 min per username) |

### External data sources

- **Resident Advisor** (GraphQL) — festivals, lineups, artist IDs, upcoming events, country.
- **FestivalFans** / **Partyflock** — additional festival listings and interest/visitor counts.
- **Spotify** — artist ID, image, followers, albums, related artists (cached).
- **Last.fm** — MusicBrainz ID, bio, listeners/playcount, similar artists, top tracks, genre tags (cached).
- **Wikipedia** — supplementary artist info.
