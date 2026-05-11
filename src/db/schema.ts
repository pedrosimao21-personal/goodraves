import { pgTable, unique, uuid, text, timestamp, index, uniqueIndex, real, integer, foreignKey, primaryKey } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const users = pgTable("users", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	username: text().notNull(),
	passwordHash: text("password_hash").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	city: text(),
	favoriteGenres: text("favorite_genres"),
}, (table) => [
	unique("users_username_unique").on(table.username),
]);

export const festivals = pgTable("festivals", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	date: text().notNull(),
	endDate: text("end_date"),
	location: text(),
	venue: text(),
	latitude: real(),
	longitude: real(),
	source: text(),
	sourceId: text("source_id"),
	imageUrl: text("image_url"),
}, (table) => [
	index("festivals_date_idx").using("btree", table.date.asc().nullsLast().op("text_ops")),
	uniqueIndex("festivals_name_date_idx").using("btree", table.name.asc().nullsLast().op("text_ops"), table.date.asc().nullsLast().op("text_ops")),
	index("festivals_source_idx").using("btree", table.source.asc().nullsLast().op("text_ops")),
]);

export const rateLimitAttempts = pgTable("rate_limit_attempts", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	identifier: text().notNull(),
	action: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("rate_limit_identifier_action_idx").using("btree", table.identifier.asc().nullsLast().op("text_ops"), table.action.asc().nullsLast().op("text_ops"), table.createdAt.asc().nullsLast().op("text_ops")),
]);

export const artists = pgTable("artists", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	spotifyId: text("spotify_id"),
	imageUrl: text("image_url"),
	spotifyFetchedAt: timestamp("spotify_fetched_at", { withTimezone: true, mode: 'string' }),
	spotifyFollowers: integer("spotify_followers"),
	spotifyAlbums: text("spotify_albums"),
	lastfmId: text("lastfm_id"),
	lastfmBio: text("lastfm_bio"),
	lastfmListeners: integer("lastfm_listeners"),
	lastfmPlaycount: integer("lastfm_playcount"),
	lastfmSimilar: text("lastfm_similar"),
	lastfmTopTracks: text("lastfm_top_tracks"),
	lastfmFetchedAt: timestamp("lastfm_fetched_at", { withTimezone: true, mode: 'string' }),
	relatedArtists: text("related_artists"),
	relatedArtistsFetchedAt: timestamp("related_artists_fetched_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("artists_spotify_followers_idx").using("btree", table.spotifyFollowers.asc().nullsLast().op("int4_ops")),
	unique("artists_name_unique").on(table.name),
]);

export const genres = pgTable("genres", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
}, (table) => [
	unique("genres_name_unique").on(table.name),
]);

export const festivalArtists = pgTable("festival_artists", {
	festivalId: text("festival_id").notNull(),
	artistId: uuid("artist_id").notNull(),
}, (table) => [
	index("festival_artists_artist_id_idx").using("btree", table.artistId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.festivalId],
			foreignColumns: [festivals.id],
			name: "festival_artists_festival_id_festivals_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.artistId],
			foreignColumns: [artists.id],
			name: "festival_artists_artist_id_artists_id_fk"
		}).onDelete("restrict"),
	primaryKey({ columns: [table.festivalId, table.artistId], name: "festival_artists_festival_id_artist_id_pk"}),
]);

export const artistGenres = pgTable("artist_genres", {
	artistId: uuid("artist_id").notNull(),
	genreId: uuid("genre_id").notNull(),
}, (table) => [
	index("artist_genres_genre_id_idx").using("btree", table.genreId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.artistId],
			foreignColumns: [artists.id],
			name: "artist_genres_artist_id_artists_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.genreId],
			foreignColumns: [genres.id],
			name: "artist_genres_genre_id_genres_id_fk"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.artistId, table.genreId], name: "artist_genres_artist_id_genre_id_pk"}),
]);

export const userArtistGlobal = pgTable("user_artist_global", {
	userId: uuid("user_id").notNull(),
	rating: integer(),
	notes: text(),
	artistId: uuid("artist_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_artist_global_user_id_users_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.artistId],
			foreignColumns: [artists.id],
			name: "user_artist_global_artist_id_artists_id_fk"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.userId, table.artistId], name: "user_artist_global_user_id_artist_id_pk"}),
]);

export const userFestivalArtistRatings = pgTable("user_festival_artist_ratings", {
	userId: uuid("user_id").notNull(),
	festivalId: text("festival_id").notNull(),
	rating: integer(),
	notes: text(),
	artistId: uuid("artist_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_artist_ratings_user_id_users_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.festivalId],
			foreignColumns: [festivals.id],
			name: "user_artist_ratings_festival_id_festivals_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.artistId],
			foreignColumns: [artists.id],
			name: "user_artist_ratings_artist_id_artists_id_fk"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.userId, table.festivalId, table.artistId], name: "user_artist_ratings_user_id_festival_id_artist_id_pk"}),
]);

export const userFestivals = pgTable("user_festivals", {
	userId: uuid("user_id").notNull(),
	festivalId: text("festival_id").notNull(),
	rating: integer(),
	notes: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_festivals_user_id_users_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.festivalId],
			foreignColumns: [festivals.id],
			name: "user_festivals_festival_id_festivals_id_fk"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.userId, table.festivalId], name: "user_festivals_user_id_festival_id_pk"}),
]);
