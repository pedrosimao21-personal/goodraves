import { auth } from '@/../auth'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getTrendingFestivals, type TrendingFestival } from '@/db/actions/trending-festivals'
import DashboardView from './_components/DashboardView'

async function fetchUserCity(userId: string): Promise<string | null> {
  try {
    const [row] = await db
      .select({ city: users.city })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
    return row?.city ?? null
  } catch {
    return null
  }
}

export default async function DashboardPage() {
  const session = await auth()
  const userId = (session?.user as any)?.id as string | undefined

  const userCity = userId ? await fetchUserCity(userId) : null
  const trendingFestivals: TrendingFestival[] = await getTrendingFestivals(userCity, null, 6).catch(() => [])

  return <DashboardView trendingFestivals={trendingFestivals} userCity={userCity} />
}
