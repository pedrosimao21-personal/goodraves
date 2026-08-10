import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  real,
  boolean,
  primaryKey,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ── Users ──────────────────────────────────────────────
export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    username: text("username").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    city: text("city"),
    favoriteGenres: text("favorite_genres"), // comma-separated list, e.g. "Techno, House"
    isAdmin: boolean("is_admin").default(false).notNull(),
  },
  (t) => [
    // Case-insensitive uniqueness: prevents "Maarten" and "maarten" coexisting.
    uniqueIndex("users_username_lower_idx").on(sql`lower(${t.username})`),
  ]
);

// ── Festivals ──────────────────────────────────────────
export const festivals = pgTable("festivals", {
  id: text("id").primaryKey(), // e.g. "ra-2403879"
  name: text("name").notNull(),
  date: text("date").notNull(), // ISO date string
  endDate: text("end_date"),
  location: text("location"),
  venue: text("venue"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  // English country name + ISO-2 code, populated at import time (or by the
  // backfill script for pre-existing rows) from location-normalizer.ts.
  // Kept as real columns rather than derived from `location` at read time
  // because ~47% of rows have no country in that free-text string at all.
  countryCode: text("country_code"),
  countryName: text("country_name"),
  source: text("source"), // "ra", "custom", "external", etc.
  sourceId: text("source_id"),
  imageUrl: text("image_url"),
  // Linked Partyflock party ID, used to import a timetable for a festival
  // whose own source (RA/FestivalFans) doesn't provide one. Independent of
  // `source`/`sourceId` — a festival can be RA-sourced and PF-linked at once.
  pfPartyId: text("pf_party_id"),
  // Last time we attempted a lineup re-import / image backfill from the origin
  // source for this festival. Stamped on every attempt regardless of outcome so
  // a festival with no announced lineup (or no available image) isn't re-scraped
  // on every page view — see LINEUP_RECHECK_STALE_MS / IMAGE_RECHECK_STALE_MS.
  lineupCheckedAt: timestamp("lineup_checked_at", { withTimezone: true }),
  imageCheckedAt: timestamp("image_checked_at", { withTimezone: true }),
  interestedCount: integer("interested_count").default(0),
  visitorsCount: integer("visitors_count").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex("festivals_name_date_idx").on(t.name, t.date),
  index("festivals_date_idx").on(t.date),
  index("festivals_source_idx").on(t.source),
  index("festivals_country_code_idx").on(t.countryCode),
  index("festivals_interested_count_idx").on(sql`${t.interestedCount} DESC`),
  // Trigram GIN indexes backing the leading-wildcard ILIKE free-text search.
  index("festivals_name_trgm_idx").using("gin", sql`${t.name} gin_trgm_ops`),
  index("festivals_venue_trgm_idx").using("gin", sql`${t.venue} gin_trgm_ops`),
  index("festivals_location_trgm_idx").using("gin", sql`${t.location} gin_trgm_ops`),
]);

// ── Festival Merges (audit trail for the hard-merge dedup) ─────────────
// When two rows turn out to be the same festival edition, the loser's data is
// copied onto the winner and the loser row is deleted. This table remembers
// that mapping so (a) old /festival/<loserId> URLs can redirect instead of
// 404ing, and (b) a wrong auto-merge is recoverable — `snapshot` holds enough
// of the loser's original state to reconstruct it. `winnerId` is deliberately
// NOT a foreign key: if the winner is itself later merged into a third
// festival (a chain), it becomes a loser in its own row here, which a strict
// FK to festivals.id can't represent. Resolve chains by following winnerId
// until it names a live festival.
export const festivalMerges = pgTable("festival_merges", {
  loserId: text("loser_id").primaryKey(),
  winnerId: text("winner_id").notNull(),
  mergedAt: timestamp("merged_at", { withTimezone: true }).defaultNow().notNull(),
  snapshot: text("snapshot").notNull(), // JSON.stringify'd — see festival-merge.ts
}, (t) => [
  index("festival_merges_winner_id_idx").on(t.winnerId),
]);

// ── Artists ────────────────────────────────────────────
// Defined before festival_artists so the FK reference resolves correctly.
export const artists = pgTable("artists", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  // Spotify cache
  spotifyId: text("spotify_id"),
  imageUrl: text("image_url"),
  spotifyFollowers: integer("spotify_followers"),
  spotifyAlbums: text("spotify_albums"),    // JSON SpotifyAlbum[]
  spotifyFetchedAt: timestamp("spotify_fetched_at", { withTimezone: true }),
  // Related artists (Spotify)
  relatedArtists: text("related_artists"),  // JSON { id, name, image, followers }[]
  relatedArtistsFetchedAt: timestamp("related_artists_fetched_at", { withTimezone: true }),
  // Last.fm cache
  lastfmId: text("lastfm_id"),             // mbid
  lastfmBio: text("lastfm_bio"),
  lastfmListeners: integer("lastfm_listeners"),
  lastfmPlaycount: integer("lastfm_playcount"),
  lastfmSimilar: text("lastfm_similar"),   // JSON { name, url, image }[]
  lastfmTopTracks: text("lastfm_top_tracks"), // JSON { name, playcount, url, listeners, previewUrl? }[]
  lastfmFetchedAt: timestamp("lastfm_fetched_at", { withTimezone: true }),
  // Resident Advisor
  raArtistId: text("ra_artist_id"),
  raUpcomingEvents: text("ra_upcoming_events"),   // JSON RAUpcomingEvent[]
  raEventsFetchedAt: timestamp("ra_events_fetched_at", { withTimezone: true }),
  // Country (from RA)
  countryCode: text("country_code"),    // ISO code, e.g. "BE", "DE", "UK"
  countryName: text("country_name"),    // Full name, e.g. "Belgium", "Germany"
}, (t) => [
  // Case-insensitive uniqueness on name (there is NO plain unique on name in
  // prod). Artist inserts use onConflictDoNothing() with no explicit target and
  // rely on this index to dedupe "Boris" / "boris". This unique index also
  // serves lookups, so no separate plain index on lower(name) is needed.
  uniqueIndex("artists_name_ci_unique").on(sql`lower(${t.name})`),
  // Partial index — only rows enriched from Resident Advisor carry a ra id.
  index("artists_ra_artist_id_idx").on(t.raArtistId).where(sql`${t.raArtistId} IS NOT NULL`),
  index("artists_spotify_followers_idx").on(t.spotifyFollowers),
  // Trigram GIN index backing the artist-name ILIKE match in festival search.
  index("artists_name_trgm_idx").using("gin", sql`${t.name} gin_trgm_ops`),
]);

// ── Festival Artists (lineup join table) ───────────────
export const festivalArtists = pgTable(
  "festival_artists",
  {
    festivalId: text("festival_id")
      .notNull()
      .references(() => festivals.id, { onDelete: "cascade" }),
    artistId: uuid("artist_id")
      .notNull()
      .references(() => artists.id, { onDelete: "restrict" }),
  },
  (t) => [
    primaryKey({ columns: [t.festivalId, t.artistId] }),
    index("festival_artists_artist_id_idx").on(t.artistId),
  ]
);

// ── User Festivals (attendance / upcoming) ─────────────
export const userFestivals = pgTable(
  "user_festivals",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    festivalId: text("festival_id")
      .notNull()
      .references(() => festivals.id, { onDelete: "cascade" }),
    rating: integer("rating"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.festivalId] })]
);

// ── Rate Limiting ──────────────────────────────────────
export const rateLimitAttempts = pgTable(
  "rate_limit_attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    identifier: text("identifier").notNull(),
    action: text("action").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("rate_limit_identifier_action_idx").on(t.identifier, t.action, t.createdAt),
  ]
);

// ── User Festival Artist Ratings (per-festival performance) ─
export const userFestivalArtistRatings = pgTable(
  "user_festival_artist_ratings",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    festivalId: text("festival_id")
      .notNull()
      .references(() => festivals.id, { onDelete: "cascade" }),
    artistId: uuid("artist_id")
      .notNull()
      .references(() => artists.id, { onDelete: "cascade" }),
    rating: integer("rating"),
    notes: text("notes"),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.festivalId, t.artistId] }),
    // migrateRatingsToMembers (b2b-split.ts) filters by festivalId + artistId
    // without userId, which can't use a leftmost prefix of the PK above.
    index("user_festival_artist_ratings_festival_artist_idx").on(t.festivalId, t.artistId),
  ]
);

// ── Want to see (upcoming-festival lineup picks) ────────
// Deliberately a separate table from userFestivalArtistRatings rather than a
// column on it: every row in that table is treated as "seen" throughout the
// app (getArtistSeenCounts, Top DJs, Insights) — adding a want-to-see column
// there would either need a matching "seen" backfill everywhere or silently
// count unattended picks as seen artists. A dedicated table sidesteps that.
export const userArtistWantToSee = pgTable(
  "user_artist_want_to_see",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    festivalId: text("festival_id")
      .notNull()
      .references(() => festivals.id, { onDelete: "cascade" }),
    artistId: uuid("artist_id")
      .notNull()
      .references(() => artists.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.festivalId, t.artistId] })]
);

// ── Genres ─────────────────────────────────────────────
export const genres = pgTable("genres", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
});

// ── Artist Genres (many-to-many join table) ────────────
export const artistGenres = pgTable(
  "artist_genres",
  {
    artistId: uuid("artist_id")
      .notNull()
      .references(() => artists.id, { onDelete: "cascade" }),
    genreId: uuid("genre_id")
      .notNull()
      .references(() => genres.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.artistId, t.genreId] }),
    index("artist_genres_genre_id_idx").on(t.genreId),
  ]
);

// ── Festival Genres (many-to-many join table) ──────────
export const festivalGenres = pgTable(
  "festival_genres",
  {
    festivalId: text("festival_id")
      .notNull()
      .references(() => festivals.id, { onDelete: "cascade" }),
    genreId: uuid("genre_id")
      .notNull()
      .references(() => genres.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.festivalId, t.genreId] }),
    index("festival_genres_genre_id_idx").on(t.genreId),
  ]
);

// ── B2B Sets (grouped artists from split B2B imports) ──
export const festivalB2bSets = pgTable("festival_b2b_sets", {
  id: uuid("id").defaultRandom().primaryKey(),
  festivalId: text("festival_id")
    .notNull()
    .references(() => festivals.id, { onDelete: "cascade" }),
  originalArtistName: text("original_artist_name").notNull(),
}, (t) => [
  index("festival_b2b_sets_festival_id_idx").on(t.festivalId),
]);

export const festivalB2bSetMembers = pgTable(
  "festival_b2b_set_members",
  {
    b2bSetId: uuid("b2b_set_id")
      .notNull()
      .references(() => festivalB2bSets.id, { onDelete: "cascade" }),
    artistId: uuid("artist_id")
      .notNull()
      .references(() => artists.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.b2bSetId, t.artistId] }),
    index("festival_b2b_set_members_artist_id_idx").on(t.artistId),
  ]
);

// ── Festival Timetable Slots ───────────────────────────
export const festivalTimetableSlots = pgTable(
  "festival_timetable_slots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    festivalId: text("festival_id")
      .notNull()
      .references(() => festivals.id, { onDelete: "cascade" }),
    artistId: uuid("artist_id")
      .notNull()
      .references(() => artists.id, { onDelete: "cascade" }),
    stageName: text("stage_name").notNull(),
    startTime: text("start_time").notNull(),
    endTime: text("end_time").notNull(),
    stageOrder: integer("stage_order").notNull(),
    slotOrder: integer("slot_order").notNull(),
    // ISO date this slot actually falls on. Needed once a multi-day festival's
    // per-day rows are merged into one: startTime/endTime are bare "HH:MM"
    // with no date, so two days reusing the same stage name at overlapping
    // clock times (e.g. Partyflock's "Area A" on both Fri and Sat) are
    // indistinguishable without this. Defaults to the source festival's own
    // `date` for slots imported before this column existed or before a merge.
    slotDate: text("slot_date").notNull(),
  },
  (t) => [
    index("festival_timetable_slots_festival_id_idx").on(t.festivalId),
    uniqueIndex("festival_timetable_slots_unique_idx").on(
      t.festivalId,
      t.artistId,
      t.stageName,
      t.startTime,
      t.endTime,
      t.slotDate,
    ),
  ]
);

// ── User Artist Global (overall artist ratings & notes) ─
export const userArtistGlobal = pgTable(
  "user_artist_global",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    artistId: uuid("artist_id")
      .notNull()
      .references(() => artists.id, { onDelete: "cascade" }),
    rating: integer("rating"),
    notes: text("notes"),
  },
  (t) => [primaryKey({ columns: [t.userId, t.artistId] })]
);
