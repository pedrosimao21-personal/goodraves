'use client'

import Link from 'next/link'
import Image from 'next/image'
import type { TimetableStage } from '@/db/actions/festivals'
import { groupSlotsByTime, type SlotGroup } from './timetable-utils'

const AVATAR_SIZE_PX = 40

type Props = {
  stages: TimetableStage[]
}

function SlotArtist({ artist, showSeparator }: {
  artist: SlotGroup['artists'][number]
  showSeparator: boolean
}) {
  return (
    <>
      <Link
        href={`/artist/${artist.artistId}/${encodeURIComponent(artist.artistName)}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          textDecoration: 'none',
          color: 'var(--text-primary)',
        }}
      >
        {artist.artistImageUrl ? (
          <Image
            src={artist.artistImageUrl}
            alt={artist.artistName}
            width={AVATAR_SIZE_PX}
            height={AVATAR_SIZE_PX}
            quality={85}
            sizes={`${AVATAR_SIZE_PX}px`}
            style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
          />
        ) : (
          <div
            style={{
              width: AVATAR_SIZE_PX,
              height: AVATAR_SIZE_PX,
              borderRadius: '50%',
              background: 'var(--bg-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1rem',
              flexShrink: 0,
            }}
          >
            🎤
          </div>
        )}
        <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>{artist.artistName}</span>
      </Link>
      {showSeparator && (
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', flexShrink: 0 }}>b2b</span>
      )}
    </>
  )
}

function SlotRow({ group }: { group: SlotGroup }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '10px 0',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div
        style={{
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
          whiteSpace: 'nowrap',
          width: 84,
          flexShrink: 0,
        }}
      >
        {group.startTime}
        <br />
        {group.endTime}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, flex: 1 }}>
        {group.artists.map((artist, index) => (
          <SlotArtist
            key={artist.artistId}
            artist={artist}
            showSeparator={index < group.artists.length - 1}
          />
        ))}
      </div>
    </div>
  )
}

function StageSection({ stage }: { stage: TimetableStage }) {
  const slotGroups = groupSlotsByTime(stage.slots)

  return (
    <div style={{ marginBottom: 24 }}>
      <h3
        style={{
          fontSize: '0.72rem',
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
          marginBottom: 4,
        }}
      >
        {stage.stageName}
      </h3>
      <div>
        {slotGroups.map(group => (
          <SlotRow key={`${group.startTime}-${group.slotOrder}`} group={group} />
        ))}
      </div>
    </div>
  )
}

export default function TimetableList({ stages }: Props) {
  return (
    <div>
      {stages.map(stage => (
        <StageSection key={stage.stageOrder} stage={stage} />
      ))}
    </div>
  )
}
