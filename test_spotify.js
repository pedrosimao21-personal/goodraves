
import axios from 'axios';

const CLIENT_ID = '125cb8098bc84681891f9d7afb64e98c';
const CLIENT_SECRET = 'f68f258f39ea4c0baa92d1e1eba12a75';

async function test() {
  console.log('--- Testing Spotify Endpoints with Axios ---');
  
  try {
    // 1. Get Token
    const authRes = await axios.post('https://accounts.spotify.com/api/token', 
      'grant_type=client_credentials',
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64'),
        }
      }
    );
    const { access_token } = authRes.data;
    console.log('Token obtained.');

    const headers = { Authorization: `Bearer ${access_token}` };

    // 2. Search Artist (Hardwell)
    const searchRes = await axios.get('https://api.spotify.com/v1/search?q=Hardwell&type=artist&limit=1', { headers });
    const artistId = searchRes.data.artists.items[0].id;
    console.log(`Artist found: Hardwell (${artistId})`);

    // 3. Test Artist Albums (Discography)
    try {
      const albumsRes = await axios.get(`https://api.spotify.com/v1/artists/${artistId}/albums?limit=5`, { headers });
      console.log(`GET /artists/${artistId}/albums: ${albumsRes.status} (${albumsRes.data.items.length} items)`);
    } catch (e) {
      console.log(`GET /artists/${artistId}/albums: ${e.response?.status || e.message}`);
    }

    // 4. Test Search for Shows (Radio Shows/Podcasts)
    try {
      const showRes = await axios.get(`https://api.spotify.com/v1/search?q=Hardwell&type=show&limit=3`, { headers });
      console.log(`GET /search?q=Hardwell&type=show: ${showRes.status}`);
      if (showRes.data.shows?.items?.length) {
        console.log(`Found ${showRes.data.shows.items.length} shows.`);
        showRes.data.shows.items.forEach(s => console.log(` - ${s.name} (${s.publisher})`));
      }
    } catch (e) {
      console.log(`GET /search?q=Hardwell&type=show: ${e.response?.status || e.message}`);
    }

    // 5. Test Top Tracks (confirming 403)
    try {
      const topRes = await axios.get(`https://api.spotify.com/v1/artists/${artistId}/top-tracks?market=NL`, { headers });
      console.log(`GET /artists/${artistId}/top-tracks: ${topRes.status}`);
    } catch (e) {
      console.log(`GET /artists/${artistId}/top-tracks: ${e.response?.status || e.message}`);
    }

  } catch (err) {
    console.error('Test failed:', err.response?.data || err.message);
  }
}

test();
