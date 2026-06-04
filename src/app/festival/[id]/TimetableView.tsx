'use client'

import { useRouter } from 'next/navigation'
import type { TimetableStage } from '@/db/actions/festivals'

type Props = {
  stages: TimetableStage[]
}

type SlotGroup = {
  startTime: string
  endTime: string
  slotOrder: number
  artists: { artistId: string; artistName: string }[]
}

/** Group consecutive slots with the same start/end time into a single block (B2B). */
function groupSlotsByTime(slots: TimetableStage['slots']): SlotGroup[] {
  const groups: SlotGroup[] = []

  for (const slot of slots) {
    const last = groups[groups.length - 1]
    if (
      last &&
      last.startTime === slot.startTime &&
      last.endTime === slot.endTime &&
      last.slotOrder === slot.slotOrder
    ) {
      last.artists.push({ artistId: slot.artistId, artistName: slot.artistName })
    } else {
      groups.push({
        startTime: slot.startTime,
        endTime: slot.endTime,
        slotOrder: slot.slotOrder,
        artists: [{ artistId: slot.artistId, artistName: slot.artistName }],
      })
    }
  }

  return groups
}

export default function TimetableView({ stages }: Props) {
  const router = useRouter()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      {stages.map((stage) => {
        const slotGroups = groupSlotsByTime(stage.slots)
        return (
          <div key={stage.stageOrder}>
            <h3 style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
              marginBottom: 12,
              marginTop: 0,
            }}>
              {stage.stageName}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {slotGroups.map((group) => (
                <div
                  key={`${group.startTime}-${group.slotOrder}`}
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 12,
                    padding: '8px 0',
                    borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,0.06))',
                  }}
                >
                  <span style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    minWidth: '10ch',
                  }}>
                    {group.startTime} – {group.endTime}
                  </span>
                  <span style={{ display: 'flex', flexWrap: 'wrap', gap: '0 6px' }}>
                    {group.artists.map((artist, index) => (
                      <span key={artist.artistId} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <button
                          onClick={() => router.push(`/artist/${artist.artistId}`)}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            fontWeight: 500,
                            color: 'var(--text-primary, #fff)',
                            textDecoration: 'none',
                            WebkitTapHighlightColor: 'transparent',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                          onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                        >
                          {artist.artistName}
                        </button>
                        {index < group.artists.length - 1 && (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>b2b</span>
                        )}
                      </span>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
