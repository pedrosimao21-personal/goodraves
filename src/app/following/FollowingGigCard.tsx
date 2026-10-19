'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useUserDataActions } from '@/context/UserDataContext'
import type { FollowingGig, GigArtist } from '@/db/actions/following-gig-builder'
import { formatDateRange } from '@/lib/format-date'
import { formatGigSet, formatNameList } from '@/lib/following-display'

const GIG_IMAGE_SIZE = 64

function GigArtistLine({ artist, isMultiDay }: { artist: GigArtist; isMultiDay: boolean }) {
  const href = `/artist/${artist.artistId}/${encodeURIComponent(artist.name)}`
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '2px 8px', fontSize: '0.85rem' }}>
      <Link href={href} style={{ fontWeight: 600, color: 'var(--accent-purple)', textDecoration: 'none' }}>
        {artist.name}
      </Link>
      {artist.sets.map((set, i) => (
        <span key={i} style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{formatGigSet(set, isMultiDay)}</span>
      ))}
    </div>
  )
}

function GoingButton({ gig }: { gig: FollowingGig }) {
  const { isUpcoming, toggleFestival } = useUserDataActions()
  const isGoing = isUpcoming(gig.festivalId)

  const handleClick = () => {
    // Same payload shape as FestivalCard, so the optimistic update files the
    // festival under "upcoming" (it reads the date from this meta).
    toggleFestival(gig.festivalId, {
      name: gig.name,
      date: gig.date,
      endDate: gig.endDate,
      venue: gig.venue,
      location: gig.location,
      image: gig.imageUrl,
      source: gig.source,
    })
  }

  return (
    <button
      className={`btn btn-sm ${isGoing ? 'btn-secondary' : 'btn-primary'}`}
      onClick={handleClick}
      aria-pressed={isGoing}
      style={{ whiteSpace: 'nowrap' }}
    >
      {isGoing ? '✓ Going' : 'Mark as Going'}
    </button>
  )
}

export default function FollowingGigCard({ gig, isNear }: { gig: FollowingGig; isNear: boolean }) {
  const isMultiDay = Boolean(gig.endDate && gig.endDate !== gig.date)
  const place = [gig.venue, gig.location].filter(Boolean).join(', ')

  return (
    <div className={`following-gig-card${isNear ? ' is-near' : ''}`}>
      <Link href={`/festival/${gig.festivalId}`} style={{ flexShrink: 0 }} aria-label={gig.name}>
        {gig.imageUrl ? (
          <Image src={gig.imageUrl} alt={gig.name} width={GIG_IMAGE_SIZE} height={GIG_IMAGE_SIZE} sizes={`${GIG_IMAGE_SIZE}px`} style={{ borderRadius: 10, objectFit: 'cover' }} />
        ) : (
          <div className="following-gig-placeholder">🎪</div>
        )}
      </Link>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          <span>{formatDateRange(gig.date, gig.endDate)}</span>
          {isNear && <span className="following-near-badge">Near you</span>}
        </div>
        <Link href={`/festival/${gig.festivalId}`} style={{ display: 'block', fontWeight: 700, color: 'inherit', textDecoration: 'none', margin: '2px 0' }}>
          {gig.name}
        </Link>
        {place && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 6 }}>{place}</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {gig.artists.map((artist) => (
            <GigArtistLine key={artist.artistId} artist={artist} isMultiDay={isMultiDay} />
          ))}
        </div>

        {gig.clashes.map((clash, i) => (
          <div key={i} className="following-clash">
            ⚠ {clash.artistA} and {clash.artistB} overlap
          </div>
        ))}

        {gig.friendsGoing.length > 0 && (
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 6 }}>
            👥 {formatNameList(gig.friendsGoing)} {gig.friendsGoing.length === 1 ? 'is' : 'are'} going
          </div>
        )}
      </div>

      <div style={{ flexShrink: 0 }}>
        <GoingButton gig={gig} />
      </div>
    </div>
  )
}
