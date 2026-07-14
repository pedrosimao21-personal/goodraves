# Goodraves

A web app for discovering electronic music festivals and raves, tracking what you've attended, and rating the DJs you saw. Integrates with Spotify, Last.fm, MusicBrainz, and Wikipedia for event and artist discovery.

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

### Seeding the Database

Festival data can be ingested from Resident Advisor scraper JSONL files:

```bash
# Convert JSONL files to a static JS data module
node scripts/seed-ra-events.js --events "EventItem.jsonl" --lineups "EventLineupItem.jsonl"

# Insert into the database
DATABASE_URL="postgres://..." npx tsx scripts/seed-db.ts
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

## Database Schema & Data Sources

### `users`

| Column | Type | Data Source |
|---|---|---|
| `id` | uuid | System-generated |
| `username` | text | User registration |
| `password_hash` | text | bcrypt hash of user-provided password |
| `created_at` | timestamptz | System-generated |

### `festivals`

| Column | Type | Data Source |
|---|---|---|
| `id` | text | Format `ra-{raId}` from RA scraper, or custom ID |
| `name` | text | **RA scraper** (`title`/`name`), **RA GraphQL API** (`event.title`), or user-created |
| `date` | text | **RA scraper** (`date`/`startDate`), **RA GraphQL** (`event.startTime`), or user input. ISO `YYYY-MM-DD` |
| `end_date` | text | **RA GraphQL API** (`event.endTime`) |
| `location` | text | **RA scraper** (`city`/`venueCity`), **RA GraphQL** (`venue.area.name, venue.area.country.name`), or user input |
| `venue` | text | **RA scraper** (`venue`/`venueName`), **RA GraphQL** (`venue.name`), or user input |
| `latitude` | real | Not currently populated |
| `longitude` | real | Not currently populated |
| `source` | text | `"ra"`, `"custom"`, or `"external"` |
| `source_id` | text | Raw RA event ID (e.g. `"2403879"`) |
| `image_url` | text | **RA GraphQL API** (`event.images[0].filename`), or user input |

### `artists`

| Column | Type | Data Source |
|---|---|---|
| `id` | uuid | System-generated |
| `name` | text | **RA scraper** lineup arrays, **RA GraphQL** (`event.artists[].name`), or user-created |
| `spotify_id` | text | **Spotify Search API** (`/v1/search?type=artist`) — cached |
| `image_url` | text | **Spotify API** — artist image — cached |
| `spotify_followers` | integer | **Spotify API** (`artist.followers.total`) — cached |
| `spotify_albums` | text | **Spotify API** (`/v1/artists/{id}/albums`) — JSON string of album objects — cached |
| `spotify_fetched_at` | timestamptz | Timestamp of last Spotify fetch. Stale after 60 days |
| `lastfm_id` | text | **Last.fm API** (`artist.getinfo`) — MusicBrainz ID |
| `lastfm_bio` | text | **Last.fm API** (`artist.bio.content`) — HTML-cleaned |
| `lastfm_listeners` | integer | **Last.fm API** (`artist.stats.listeners`) |
| `lastfm_playcount` | integer | **Last.fm API** (`artist.stats.playcount`) |
| `lastfm_similar` | text | **Last.fm API** (`artist.similar.artist`) — JSON string of top 5 similar artists |
| `lastfm_top_tracks` | text | **Last.fm API** (`artist.gettoptracks`) — JSON string of top 8 tracks |
| `lastfm_fetched_at` | timestamptz | Timestamp of last Last.fm fetch. Stale after 7 days |

### `genres`

| Column | Type | Data Source |
|---|---|---|
| `id` | uuid | System-generated |
| `name` | text | **Last.fm API** (`artist.tags.tag[].name`) — normalized, lowercased, blacklist-filtered, and deduplicated |

### `artist_genres`

| Column | Type | Data Source |
|---|---|---|
| `artist_id` | uuid | FK → `artists.id` |
| `genre_id` | uuid | FK → `genres.id` |

### `festival_artists`

| Column | Type | Data Source |
|---|---|---|
| `festival_id` | text | FK → `festivals.id`. From seed scripts, RA GraphQL fetch, or user festival creation |
| `artist_id` | uuid | FK → `artists.id`. Resolved from artist name lookup |

### `user_festivals`

| Column | Type | Data Source |
|---|---|---|
| `user_id` | uuid | FK → `users.id`. Authenticated user session |
| `festival_id` | text | FK → `festivals.id`. User action |
| `status` | text | User choice: `"attended"` or `"upcoming"` |
| `rating` | integer | User input (1–5) |
| `notes` | text | User input |
| `created_at` | timestamptz | System-generated |

### `user_festival_artist_ratings`

| Column | Type | Data Source |
|---|---|---|
| `user_id` | uuid | FK → `users.id`. Authenticated user session |
| `festival_id` | text | FK → `festivals.id`. User action context |
| `artist_id` | uuid | FK → `artists.id`. User action |
| `rating` | integer | User input (1–5) |
| `notes` | text | User input |

### `user_artist_global`

| Column | Type | Data Source |
|---|---|---|
| `user_id` | uuid | FK → `users.id`. Authenticated user session |
| `artist_id` | uuid | FK → `artists.id`. User action |
| `rating` | integer | User input (1–5) |
| `notes` | text | User input (max 5000 chars) |

### `rate_limit_attempts`

| Column | Type | Data Source |
|---|---|---|
| `id` | uuid | System-generated |
| `identifier` | text | Username (login rate limiting) |
| `action` | text | `"login"` |
| `created_at` | timestamptz | System-generated. 10 attempts per 15 minutes per username |
