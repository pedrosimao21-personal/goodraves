# Goodraves

A React single-page PWA for discovering electronic music festivals and raves, tracking what you've attended, and rating the DJs you saw. Integrates with Ticketmaster, EDMTrain, Spotify, Last.fm, MusicBrainz, and Wikipedia for event and artist discovery.

## Architecture

- **Frontend**: React 18 + Vite SPA with React Router 6, Recharts for analytics, and Leaflet for maps
- **Backend**: Single Netlify Function (`netlify/functions/sync.js`) that proxies cloud sync requests to jsonblob.com
- **State**: Global `useReducer` context (`src/context/UserDataContext.jsx`) persisted to `localStorage` with optional cross-device sync via jsonblob.com
- **Auth**: None — fully client-side, no user accounts

### Project Structure

```
src/
├── api/          # External API clients (Spotify, Ticketmaster, EDMTrain, Last.fm, etc.)
├── components/   # Reusable UI (map, cards, navbar, sync settings)
├── context/      # Global state provider
├── data/         # Pre-seeded Resident Advisor events
├── hooks/        # useFetch, useDebounce
└── pages/        # Route pages (Home, Dashboard, Timeline, Insights, TopDJs)
```

## Environment Variables

Create a `.env` file in the project root. All variables are optional — the app works without them, falling back to local RA data only.

```
VITE_TICKETMASTER_KEY=<ticketmaster-discovery-api-key>
VITE_EDMTRAIN_KEY=<edmtrain-api-key>
VITE_LASTFM_KEY=<lastfm-api-key>
VITE_SPOTIFY_CLIENT_ID=<spotify-client-id>
VITE_SPOTIFY_CLIENT_SECRET=<spotify-client-secret>
```

## Development

```bash
npm install
npm run dev
```

The Vite dev server includes middleware that proxies `/.netlify/functions/sync` requests to jsonblob.com, so cloud sync works identically in development and production.

## Build & Preview

```bash
npm run build      # Production build → dist/
npm run preview    # Preview the production build locally
```

## Deployment

Deployed to **Netlify** via `netlify.toml`:

- Build command: `npm run build`
- Publish directory: `dist/`
- Functions directory: `netlify/functions/`
- SPA fallback: `/* → /index.html`
