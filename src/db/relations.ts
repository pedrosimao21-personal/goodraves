import { relations } from "drizzle-orm/relations";
import { festivals, festivalArtists, artists, artistGenres, festivalGenres, genres, users, userArtistGlobal, userFestivalArtistRatings, userFestivals } from "@/db/schema";

export const festivalArtistsRelations = relations(festivalArtists, ({one}) => ({
	festival: one(festivals, {
		fields: [festivalArtists.festivalId],
		references: [festivals.id]
	}),
	artist: one(artists, {
		fields: [festivalArtists.artistId],
		references: [artists.id]
	}),
}));

export const festivalsRelations = relations(festivals, ({many}) => ({
	festivalArtists: many(festivalArtists),
	festivalGenres: many(festivalGenres),
	userFestivalArtistRatings: many(userFestivalArtistRatings),
	userFestivals: many(userFestivals),
}));

export const artistsRelations = relations(artists, ({many}) => ({
	festivalArtists: many(festivalArtists),
	artistGenres: many(artistGenres),
	userArtistGlobals: many(userArtistGlobal),
	userFestivalArtistRatings: many(userFestivalArtistRatings),
}));

export const artistGenresRelations = relations(artistGenres, ({one}) => ({
	artist: one(artists, {
		fields: [artistGenres.artistId],
		references: [artists.id]
	}),
	genre: one(genres, {
		fields: [artistGenres.genreId],
		references: [genres.id]
	}),
}));

export const festivalGenresRelations = relations(festivalGenres, ({one}) => ({
	festival: one(festivals, {
		fields: [festivalGenres.festivalId],
		references: [festivals.id]
	}),
	genre: one(genres, {
		fields: [festivalGenres.genreId],
		references: [genres.id]
	}),
}));

export const genresRelations = relations(genres, ({many}) => ({
	artistGenres: many(artistGenres),
	festivalGenres: many(festivalGenres),
}));

export const userArtistGlobalRelations = relations(userArtistGlobal, ({one}) => ({
	user: one(users, {
		fields: [userArtistGlobal.userId],
		references: [users.id]
	}),
	artist: one(artists, {
		fields: [userArtistGlobal.artistId],
		references: [artists.id]
	}),
}));

export const usersRelations = relations(users, ({many}) => ({
	userArtistGlobals: many(userArtistGlobal),
	userFestivalArtistRatings: many(userFestivalArtistRatings),
	userFestivals: many(userFestivals),
}));

export const userFestivalArtistRatingsRelations = relations(userFestivalArtistRatings, ({one}) => ({
	user: one(users, {
		fields: [userFestivalArtistRatings.userId],
		references: [users.id]
	}),
	festival: one(festivals, {
		fields: [userFestivalArtistRatings.festivalId],
		references: [festivals.id]
	}),
	artist: one(artists, {
		fields: [userFestivalArtistRatings.artistId],
		references: [artists.id]
	}),
}));

export const userFestivalsRelations = relations(userFestivals, ({one}) => ({
	user: one(users, {
		fields: [userFestivals.userId],
		references: [users.id]
	}),
	festival: one(festivals, {
		fields: [userFestivals.festivalId],
		references: [festivals.id]
	}),
}));