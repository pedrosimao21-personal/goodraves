import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  real,
  primaryKey,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// ── Users ──────────────────────────────────────────────
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  city: text("city"),
  favoriteGenres: text("favorite_genres"), // comma-separated list, e.g. "Techno, House"
});

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
  source: text("source"), // "ra", "custom", "external", etc.
  sourceId: text("source_id"),
  imageUrl: text("image_url"),
  interestedCount: integer("interested_count").default(0),
}, (t) => [
  uniqueIndex("festivals_name_date_idx").on(t.name, t.date),
  index("festivals_date_idx").on(t.date),
  index("festivals_source_idx").on(t.source),
]);

// ── Artists ────────────────────────────────────────────
// Defined before festival_artists so the FK reference resolves correctly.
export const artists = pgTable("artists", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
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
  index("artists_spotify_followers_idx").on(t.spotifyFollowers),
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
