'use client'

import type { Clash } from '@/lib/timetable-clash'

export default function ClashBanner({ clashes }: { clashes: Clash[] }) {
  if (clashes.length === 0) return null

  return (
    <div className="clash-banner">
      <div className="clash-banner-title">
        ⚠️ {clashes.length} lineup clash{clashes.length !== 1 ? 'es' : ''} in your picks
      </div>
      <div className="clash-banner-list">
        {clashes.map((c, i) => (
          <div key={i} className="clash-banner-row">
            <strong>{c.a.artistName}</strong> ({c.a.stageName}, {c.a.startTime}–{c.a.endTime}) overlaps{' '}
            <strong>{c.b.artistName}</strong> ({c.b.stageName}, {c.b.startTime}–{c.b.endTime})
          </div>
        ))}
      </div>
    </div>
  )
}
