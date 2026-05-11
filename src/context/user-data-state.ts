import type { InitialUserData } from '@/db/actions/get-initial-data'

export interface FestivalMeta {
  name: string
  date: string
  endDate?: string
  venue?: string | { name: string; city?: string }
  location?: string
  latitude?: number
  longitude?: number
  source?: string
  sourceId?: string
  imageUrl?: string | null
  lineup?: string[]
  [key: string]: any
}

export interface UserDataState {
  attendedFestivals: string[]
  upcomingFestivals: string[]
  festivalMeta: Record<string, FestivalMeta>
  seenArtists: Record<string, string[]>
  artistMeta: Record<string, any>
  artistRatings: Record<string, number>
  performanceRatings: Record<string, number>
  festivalRatings: Record<string, number>
  artistNotes: Record<string, string>
  festivalNotes: Record<string, string>
  raEvents: Record<string, any>
}

export interface UserDataContextType {
  // State
  attendedFestivals: string[]
  upcomingFestivals: string[]
  festivalMeta: Record<string, FestivalMeta>
  seenArtists: Record<string, string[]>
  artistMeta: Record<string, any>
  artistRatings: Record<string, number>
  performanceRatings: Record<string, number>
  festivalRatings: Record<string, number>
  artistNotes: Record<string, string>
  festivalNotes: Record<string, string>
  raEvents: Record<string, any>
  loaded: boolean
  // Mutations
  toggleAttended: (eventId: string, meta?: any) => Promise<void>
  toggleUpcoming: (eventId: string, meta?: any) => Promise<void>
  toggleSawArtist: (eventId: string, artistId: string, artistMeta?: any) => Promise<void>
  setRating: (artistId: string, rating: number) => Promise<void>
  setPerformanceRating: (eventId: string, artistId: string, rating: number) => Promise<void>
  setFestivalRating: (eventId: string, rating: number) => Promise<void>
  setNotes: (artistId: string, notes: string) => Promise<void>
  setFestivalNotes: (eventId: string, notes: string) => Promise<void>
  // Reads
  isAttended: (eventId: string) => boolean
  isUpcoming: (eventId: string) => boolean
  didSeeArtist: (eventId: string, artistId: string) => boolean
  getSeenCount: (eventId: string) => number
  getRating: (artistId: string) => number
  getPerformanceRating: (eventId: string, artistId: string) => number
  getFestivalRating: (eventId: string) => number
  getNotes: (artistId: string) => string
  getFestivalNotes: (eventId: string) => string
  getFestivalMeta: (eventId: string) => FestivalMeta | null
  getArtistMeta: (artistId: string) => any
  getArtistSeenCounts: () => Record<string, { count: number; events: string[] }>
  getAverageArtistRating: (artistId: string) => number
  // Actions
  exportData: () => void
  importData: (data: any) => void
  addCustomFestival: (meta: any, lineup?: any[]) => Promise<string>
  clearFestivals: (type: string) => Promise<void>
  updateFestivalMeta: (id: string, meta: any) => void
  batchEnrichArtists: (metadata: Record<string, any>) => void
  batchImportRA: (events: Record<string, any>) => Promise<void>
  clearImportedRA: () => void
}

/** Build the upsert payload used by toggleAttended / toggleUpcoming / addCustomFestival */
export function buildUpsertPayload(eventId: string, meta: any) {
  return {
    id: eventId,
    name: meta.name,
    date: meta.date ?? meta.startDate ?? '',
    venue: typeof meta.venue === 'object' ? meta.venue?.name : meta.venue,
    location: meta.location ?? (typeof meta.venue === 'object' ? meta.venue?.city : undefined),
    imageUrl: meta.imageUrl ?? meta.image ?? null,
    source: meta.source ?? (eventId.startsWith('ra-') ? 'ra' : 'external'),
    lineup: meta.lineup?.length ? meta.lineup : undefined,
  }
}

export const DEFAULT_STATE: UserDataState = {
  attendedFestivals: [],
  upcomingFestivals: [],
  festivalMeta: {},
  seenArtists: {},
  artistMeta: {},
  artistRatings: {},
  performanceRatings: {},
  festivalRatings: {},
  artistNotes: {},
  festivalNotes: {},
  raEvents: {},
}

/** Transform raw DB data into local state shape */
export function transformDbData(data: NonNullable<InitialUserData>): UserDataState {
  const attended: string[] = []
  const upcoming: string[] = []
  const festivalMeta: Record<string, FestivalMeta> = {}
  const festivalRatings: Record<string, number> = {}
  const seenArtists: Record<string, string[]> = {}
  const performanceRatings: Record<string, number> = {}
  const artistRatings: Record<string, number> = {}
  const artistNotes: Record<string, string> = {}
  const festivalNotes: Record<string, string> = {}

  const lineupByFestival: Record<string, string[]> = {}
  for (const row of data.lineups) {
    if (!lineupByFestival[row.festivalId]) lineupByFestival[row.festivalId] = []
    lineupByFestival[row.festivalId].push(row.artistName)
  }

  for (const f of data.festivals) {
    if (f.status === 'attended') attended.push(f.festivalId)
    else upcoming.push(f.festivalId)

    festivalMeta[f.festivalId] = {
      name: f.name,
      date: f.date,
      venue: f.venue ? { name: f.venue, city: f.location ?? undefined } : undefined,
      location: f.location ?? undefined,
      imageUrl: f.imageUrl,
      source: f.source ?? undefined,
      lineup: lineupByFestival[f.festivalId] ?? [],
    }

    if (f.rating) festivalRatings[f.festivalId] = f.rating
    if (f.notes) festivalNotes[f.festivalId] = f.notes
  }

  for (const ar of data.artistRatings) {
    if (!seenArtists[ar.festivalId]) seenArtists[ar.festivalId] = []
    seenArtists[ar.festivalId].push(ar.artistId)
    if (ar.rating) {
      performanceRatings[`${ar.festivalId}::${ar.artistId}`] = ar.rating
    }
  }

  for (const g of data.globalArtistData) {
    if (g.rating) artistRatings[g.artistId] = g.rating
    if (g.notes) artistNotes[g.artistId] = g.notes
  }

  const artistMeta: Record<string, any> = {}
  for (const a of (data.artistGenres ?? [])) {
    artistMeta[a.id] = {
      name: a.name,
      genres: a.genres ?? [],
    }
  }

  return {
    attendedFestivals: attended,
    upcomingFestivals: upcoming,
    festivalMeta,
    seenArtists,
    artistMeta,
    artistRatings,
    performanceRatings,
    festivalRatings,
    artistNotes,
    festivalNotes,
    raEvents: {},
  }
}
