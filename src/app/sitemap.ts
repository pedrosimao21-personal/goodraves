import type { MetadataRoute } from 'next'
import { and, asc, sql } from 'drizzle-orm'
import { db } from '@/db'
import { festivals } from '@/db/schema'
import { SITE_URL } from '@/lib/site'
import { toIsoDate } from '@/lib/dates'

// Rebuilt at most daily: the festival list only changes with the daily imports.
export const revalidate = 86400

// Google's per-file cap is 50,000 URLs; upcoming festivals are a few thousand.
const MAX_FESTIVAL_URLS = 10_000

const STATIC_PATHS = ['/', '/top-djs', '/privacy', '/terms']

/** Static pages plus every festival that hasn't ended yet. User-created (custom) festivals stay out. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const today = toIsoDate(new Date())
  const rows = await db
    .select({ id: festivals.id, updatedAt: festivals.updatedAt })
    .from(festivals)
    .where(and(sql`coalesce(${festivals.endDate}, ${festivals.date}) >= ${today}`, sql`${festivals.source} IS DISTINCT FROM 'custom'`))
    .orderBy(asc(festivals.date))
    .limit(MAX_FESTIVAL_URLS)

  return [
    ...STATIC_PATHS.map(path => ({ url: `${SITE_URL}${path}` })),
    ...rows.map(row => ({ url: `${SITE_URL}/festival/${row.id}`, lastModified: row.updatedAt })),
  ]
}
