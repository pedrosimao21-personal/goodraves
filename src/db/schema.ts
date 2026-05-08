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
}, (t) => [
  index("festivals_name_idx").on(t.name),
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
  genres: text("genres"),           // JSON string[]
  spotifyUrl: text("spotify_url"),
  spotifyFollowers: integer("spotify_followers"),
  spotifyAlbums: text("spotify_albums"),    // JSON SpotifyAlbum[]
  spotifyFetchedAt: timestamp("spotify_fetched_at", { withTimezone: true }),
  // Last.fm cache
  lastfmId: text("lastfm_id"),             // mbid
  lastfmUrl: text("lastfm_url"),
  lastfmBio: text("lastfm_bio"),
  lastfmTags: text("lastfm_tags"),         // JSON string[]
  lastfmListeners: integer("lastfm_listeners"),
  lastfmPlaycount: integer("lastfm_playcount"),
  lastfmSimilar: text("lastfm_similar"),   // JSON { name, url, image }[]
  lastfmTopTracks: text("lastfm_top_tracks"), // JSON { name, playcount, url, listeners }[]
  lastfmFetchedAt: timestamp("lastfm_fetched_at", { withTimezone: true }),
});

// ── Festival Artists (lineup join table) ───────────────
// artist_name references artists.name so every lineup entry has a
// corresponding artist record (created when the lineup is saved).
export const festivalArtists = pgTable(
  "festival_artists",
  {
    festivalId: text("festival_id")
      .notNull()
      .references(() => festivals.id, { onDelete: "cascade" }),
    artistName: text("artist_name")
      .notNull()
      .references(() => artists.name, { onDelete: "restrict" }),
  },
  (t) => [
    primaryKey({ columns: [t.festivalId, t.artistName] }),
    index("festival_artists_artist_name_idx").on(t.artistName),
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
    status: text("status").notNull().default("attended"), // "attended" | "upcoming"
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

// ── User Artist Ratings (per-festival performance) ─────
export const userArtistRatings = pgTable(
  "user_artist_ratings",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    festivalId: text("festival_id")
      .notNull()
      .references(() => festivals.id, { onDelete: "cascade" }),
    artistName: text("artist_name").notNull(),
    rating: integer("rating"),
    notes: text("notes"),
  },
  (t) => [primaryKey({ columns: [t.userId, t.festivalId, t.artistName] })]
);

// ── User Artist Global (overall artist ratings & notes) ─
export const userArtistGlobal = pgTable(
  "user_artist_global",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    artistName: text("artist_name").notNull(),
    rating: integer("rating"),
    notes: text("notes"),
  },
  (t) => [primaryKey({ columns: [t.userId, t.artistName] })]
);
