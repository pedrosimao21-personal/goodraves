export {};

async function main() {
  const { db } = await import('../src/db/index.js');
  const { artists } = await import('../src/db/schema.js');
  const { sql } = await import('drizzle-orm');

  const clearFields = {
    spotifyId: null,
    imageUrl: null,
    spotifyFollowers: null,
    spotifyAlbums: null,
    spotifyFetchedAt: null,
    relatedArtists: null,
    relatedArtistsFetchedAt: null,
    lastfmId: null,
    lastfmBio: null,
    lastfmListeners: null,
    lastfmPlaycount: null,
    lastfmSimilar: null,
    lastfmTopTracks: null,
    lastfmFetchedAt: null,
    raArtistId: null,
    raUpcomingEvents: null,
    raEventsFetchedAt: null,
    countryCode: null,
    countryName: null,
  };

  for (const name of ['Franck', 'Uberkikz', 'Überkikz']) {
    await db
      .update(artists)
      .set(clearFields)
      .where(sql`lower(${artists.name}) = lower(${name})`);
    console.log(`Cleared cache for: ${name}`);
  }

  console.log('Done');
}

main().catch(console.error).finally(() => process.exit(0));
