'use client'

import Link from 'next/link'
import Image from 'next/image'
import { type TrendingFestival } from '@/db/actions/trending-festivals'
import { formatDate } from '@/lib/format-date'

function CalendarIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}

function MapPinIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" />
    </svg>
  )
}

function FestivalThumbnail({ festival }: { festival: TrendingFestival }) {
  if (festival.imageUrl) {
    return (
      <Image
        src={festival.imageUrl}
        alt={festival.name}
        width={60}
        height={60}
        sizes="60px"
        className="upcoming-festival-thumb"
        style={{ objectFit: 'cover' }}
      />
    )
  }

  return (
    <div className="upcoming-festival-thumb upcoming-festival-thumb-placeholder">
      🎪
    </div>
  )
}

function FestivalRow({ festival }: { festival: TrendingFestival }) {
  return (
    <Link href={`/festival/${festival.id}`} className="upcoming-festival-row">
      <FestivalThumbnail festival={festival} />

      <div className="upcoming-festival-info">
        <span className="upcoming-festival-name">{festival.name}</span>

        <div className="upcoming-festival-meta">
          <span className="upcoming-festival-meta-item">
            <CalendarIcon />
            {formatDate(festival.date)}
          </span>

          {festival.location && (
            <span className="upcoming-festival-meta-item">
              <MapPinIcon />
              {festival.location}
            </span>
          )}

          {festival.distanceKm !== null && (
            <span className="upcoming-festival-distance">
              {Math.round(festival.distanceKm)} km away
            </span>
          )}

          {festival.interestedCount > 0 && (
            <span className="trending-badge">
              🔥 {festival.interestedCount.toLocaleString()} interested
            </span>
          )}

          {festival.visitorsCount > 0 && (
            <span className="trending-badge">
              👥 {festival.visitorsCount.toLocaleString()} going
            </span>
          )}

          {festival.genres?.map((genre) => (
            <span key={genre} className="tag">{genre}</span>
          ))}
        </div>
      </div>
    </Link>
  )
}

type Props = {
  festivals: TrendingFestival[]
  userCity: string | null
}

export default function TrendingFestivalsSection({ festivals, userCity }: Props) {
  const sectionTitle = userCity
    ? `Trending Festivals near ${userCity}`
    : 'Trending Festivals'

  return (
    <section className="upcoming-festivals-section">
      <div className="upcoming-festivals-header">
        <h2 className="upcoming-festivals-title">{sectionTitle}</h2>
        <Link href="/search?type=festivals" className="upcoming-festivals-view-all">
          View all
        </Link>
      </div>

      <div className="upcoming-festivals-list">
        {festivals.map((festival) => (
          <FestivalRow key={festival.id} festival={festival} />
        ))}
      </div>
    </section>
  )
}
