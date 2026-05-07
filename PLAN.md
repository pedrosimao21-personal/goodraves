# Goodraves — Migration Plan

## Tech Stack

| Layer | Current | Proposed | Why |
|-------|---------|----------|-----|
| Framework | Vite + React SPA | **Next.js (App Router, TypeScript)** | SSR, API routes, middleware — no separate backend needed |
| Hosting | Netlify | **Vercel** | Best Next.js support, generous free tier |
| Database | localStorage | **Neon (Postgres)** | Free tier with 0.5GB, serverless-friendly, sleeps on inactivity |
| ORM | — | **Drizzle** | Lightweight, type-safe, simple migrations, works great with Neon's serverless driver |
| Auth | — | **Auth.js v5 + Credentials provider** | Free, self-hosted, username/password with bcrypt hashing |
| Cloud sync | jsonblob.com proxy | **Drop it** | Replaced by the real database |

### Why these choices over alternatives

- **Neon over PlanetScale/Supabase**: PlanetScale killed their free tier. Supabase is great but heavier — Neon gives you raw Postgres with a generous free tier and a serverless driver built for Vercel edge.
- **Drizzle over Prisma**: Prisma has cold-start issues on serverless and a heavier bundle. Drizzle is leaner and faster for Vercel functions.
- **Auth.js over Clerk/Supabase Auth**: Completely free and self-hosted. Clerk has a free tier but with limits. Auth.js is the standard for Next.js.
- **Credentials provider over OAuth**: Simpler setup, no third-party dependency, no email infrastructure. Users register with username + password. OAuth can be added later.

---

## Migration Plan

### Phase 1 — Next.js scaffold + pages

- [ ] Init a new Next.js project with App Router and TypeScript (`npx create-next-app@latest`)
- [ ] Install dependencies: `react-leaflet`, `leaflet`, `recharts`, `axios`, `html2canvas`
- [ ] Copy `src/index.css` into the Next.js project as the global stylesheet
- [ ] Port route pages to Next.js file-based routing:
  - [ ] `src/pages/Home.jsx` → `app/page.tsx`
  - [ ] `src/pages/FestivalDetail.jsx` → `app/festival/[id]/page.tsx`
  - [ ] `src/pages/ArtistDetail.jsx` → `app/artist/[name]/page.tsx`
  - [ ] `src/pages/Dashboard.jsx` → `app/dashboard/page.tsx`
  - [ ] `src/pages/Timeline.jsx` → `app/timeline/page.tsx`
  - [ ] `src/pages/TopDJs.jsx` → `app/top-djs/page.tsx`
  - [ ] `src/pages/Insights.jsx` → `app/insights/page.tsx`
- [ ] Move `src/components/` into the Next.js project, convert JSX → TSX
- [ ] Move `src/hooks/`, `src/api/`, `src/context/`, `src/data/` as-is
- [ ] Replace `<BrowserRouter>` routing with Next.js `<Link>` and `useRouter`
- [ ] Add `"use client"` directives to components that use browser APIs (Leaflet, localStorage, html2canvas)
- [ ] Remove `netlify.toml`, `netlify/functions/sync.js`, and `src/api/cloudSync.js`
- [ ] Remove `vite.config.js` and Vite-specific `index.html`
- [ ] Verify the app runs locally with `npm run dev`
- [ ] 🧑 **HUMAN**: Create a Vercel account and link the repo
- [ ] 🧑 **HUMAN**: Deploy to Vercel, confirm it works

### Phase 2 — Database

- [ ] 🧑 **HUMAN**: Create a Neon Postgres project at [neon.tech](https://neon.tech) (free tier)
- [ ] 🧑 **HUMAN**: Copy the connection string and add it to `.env.local` as `DATABASE_URL`
- [ ] 🧑 **HUMAN**: Add `DATABASE_URL` to Vercel environment variables
- [ ] Install Drizzle ORM and Neon serverless driver (`drizzle-orm`, `@neondatabase/serverless`, `drizzle-kit`)
- [ ] Create `drizzle.config.ts` pointing at `DATABASE_URL`
- [ ] Create `src/db/index.ts` — Neon client + Drizzle instance
- [ ] Define schema in `src/db/schema.ts`:
  - [ ] `users` — `id` (uuid), `username` (unique), `password_hash`, `created_at`
  - [ ] `festivals` — `id`, `name`, `date`, `end_date`, `location`, `venue`, `latitude`, `longitude`, `source`, `source_id`, `image_url`
  - [ ] `festival_artists` — `festival_id` (FK), `artist_name` (join table for lineups)
  - [ ] `artists` — `id`, `name`, `spotify_id`, `image_url`, `genres`
  - [ ] `user_festivals` — `user_id` (FK), `festival_id` (FK), `status` (attended/upcoming), `rating`, `notes`, `created_at`
  - [ ] `user_artist_ratings` — `user_id` (FK), `festival_id` (FK), `artist_name`, `rating`, `notes`
- [ ] Generate and run the initial migration (`npx drizzle-kit generate` + `npx drizzle-kit migrate`)
- [ ] Write a seed script to insert the 663 RA events from `src/data/ra-events.js` into the database
- [ ] Run the seed script against Neon
- [ ] Build server actions for core CRUD: list festivals, get festival, add attendance, rate artist, add notes

### Phase 3 — Auth (username/password)

- [ ] Install `next-auth@beta` (Auth.js v5) and `bcrypt`
- [ ] Generate an `AUTH_SECRET` (`npx auth secret`) and add to `.env.local`
- [ ] 🧑 **HUMAN**: Add `AUTH_SECRET` to Vercel environment variables
- [ ] Create `auth.ts` at the project root — configure Auth.js with Credentials provider
- [ ] Implement the `authorize` callback: look up user by username, verify password with bcrypt
- [ ] Create `app/api/auth/[...nextauth]/route.ts` — Auth.js route handler
- [ ] Create `app/register/page.tsx` — registration form (username + password)
- [ ] Create a `/api/register` route or server action — validate input, hash password, insert into `users`
- [ ] Create `app/login/page.tsx` — login form calling `signIn("credentials", ...)`
- [ ] Update `Navbar` to show session state (username + sign out button, or login/register links)
- [ ] Add `middleware.ts` to protect write routes (`/dashboard`, `/api/...` mutations)
- [ ] Keep all read/browse routes public (Home, festival detail, artist detail, search)

### Phase 4 — Migrate state from client to server

- [ ] Replace festival list in Dashboard with a server component that queries `user_festivals` from the database
- [ ] Replace attendance toggling with a server action that inserts/deletes `user_festivals` rows
- [ ] Replace rating and notes updates with server actions writing to `user_festivals` / `user_artist_ratings`
- [ ] Replace artist stats in TopDJs/Insights with database queries (aggregations)
- [ ] Convert Timeline page to load data from the database
- [ ] Keep client-side state only for UI concerns: search input, filter toggles, modal open/close
- [ ] Remove `UserDataContext.jsx` and all localStorage read/write logic
- [ ] Remove `SyncSettings.jsx` and any remaining jsonblob references
- [ ] Test that a fresh browser (no localStorage) can log in and see all saved data

### Phase 5 — Move API keys server-side

- [ ] Create server actions or API routes for each external API:
  - [ ] Ticketmaster event search
  - [ ] EDMTrain event search
  - [ ] Spotify artist lookup (Client Credentials flow)
  - [ ] Last.fm artist bio/tags
  - [ ] Wikipedia image lookup
- [ ] Move API keys from `VITE_*` env vars to `process.env.*` (server-only)
- [ ] 🧑 **HUMAN**: Add all API keys to Vercel environment variables
- [ ] Update frontend components to call the new server actions instead of external APIs directly
- [ ] Remove `src/api/` client-side API modules
- [ ] Add response caching where appropriate (`unstable_cache` or `revalidate`)

### Phase 6 — Polish

- [ ] Add `<Suspense>` boundaries with skeleton loaders on data-fetching pages
- [ ] Add error boundaries for server component failures
- [ ] Replace `<img>` tags with `next/image` for optimized loading
- [ ] Add form validation on login/register (min password length, username format)
- [ ] Add basic rate limiting on `/api/register` and login to prevent brute force
- [ ] Update `public/manifest.json` for the new Vercel domain
- [ ] 🧑 **HUMAN**: Update DNS / custom domain in Vercel if applicable
- [ ] 🧑 **HUMAN**: Decommission the old Netlify deployment

---

## Cost Breakdown

| Service | Free tier limits | Enough for a side project? |
|---------|-----------------|---------------------------|
| **Vercel** | 100GB bandwidth, serverless functions, 1 project | Yes |
| **Neon Postgres** | 0.5GB storage, 190 compute hours/mo | Yes |
| **Auth.js** | Self-hosted, no limits | Yes |

**Total cost: $0/mo** until you outgrow the free tiers.
