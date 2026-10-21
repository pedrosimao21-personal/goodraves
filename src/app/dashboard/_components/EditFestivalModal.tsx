'use client'

import React, { useState, useEffect } from 'react'
import { useUserData } from '@/context/UserDataContext'
import { isAllowedImageHost } from '@/lib/imageHosts'
import { getFestivalLineupNames } from '@/db/actions/get-initial-data'
import { keepKeyboardOpenOnTap } from '@/lib/touch-tap'
import Sheet, { SheetActions } from '@/components/Sheet'
import formStyles from './DashboardForms.module.css'

const LINEUP_ROWS = 3
const SAVED_FEEDBACK_DELAY_MS = 800

export default function EditFestivalModal({ eventId, onClose }: { eventId: string; onClose: () => void }) {
  const { getFestivalMeta, updateFestivalMeta } = useUserData()
  const meta = getFestivalMeta(eventId)

  const venueObj = typeof meta?.venue === 'object' ? meta.venue : null
  const [name, setName] = useState(meta?.name ?? '')
  const [date, setDate] = useState(meta?.date ?? '')
  const [venue, setVenue] = useState(venueObj?.name ?? (typeof meta?.venue === 'string' ? meta.venue : ''))
  const [city, setCity] = useState(venueObj?.city ?? (typeof meta?.location === 'string' ? meta.location : '') ?? '')
  const [image, setImage] = useState(meta?.image ?? meta?.imageUrl ?? '')
  const [lineup, setLineup] = useState((meta?.lineup ?? []).join(', '))
  const [lineupLoading, setLineupLoading] = useState(!meta?.lineup)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (meta?.lineup) return
    setLineupLoading(true)
    getFestivalLineupNames(eventId).then((names) => {
      setLineup(names.join(', '))
      setLineupLoading(false)
    })
  }, [eventId, meta?.lineup])

  if (!meta) return null

  const isImageInvalid = image && !isAllowedImageHost(image)

  const handleSave = () => {
    if (isImageInvalid) return
    const updatedMeta = {
      ...meta,
      name: name.trim() || meta.name,
      date: date.trim() || meta.date,
      venue: { name: venue.trim() || null, city: city.trim() || null },
      location: city.trim() || null,
      image: image.trim() || null,
      lineup: lineup.split(/[,\n]/).map(s => s.trim()).filter(Boolean),
    }
    updateFestivalMeta(eventId, updatedMeta)
    setSaved(true)
    setTimeout(() => { setSaved(false); onClose() }, SAVED_FEEDBACK_DELAY_MS)
  }

  return (
    <Sheet title="Edit festival" eyebrow="Admin · festival" onClose={onClose}>
      <div className="form-stack">
        <div>
          <label className="form-label" htmlFor="edit-festival-name">Event name</label>
          <input id="edit-festival-name" className="form-input" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div>
          <label className="form-label" htmlFor="edit-festival-date">Date</label>
          <input id="edit-festival-date" type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div className={formStyles.pair}>
          <div>
            <label className="form-label" htmlFor="edit-festival-venue">Venue</label>
            <input id="edit-festival-venue" className="form-input" value={venue} onChange={e => setVenue(e.target.value)} placeholder="e.g. Gashouder" />
          </div>
          <div>
            <label className="form-label" htmlFor="edit-festival-city">City</label>
            <input id="edit-festival-city" className="form-input" value={city} onChange={e => setCity(e.target.value)} placeholder="e.g. Amsterdam" />
          </div>
        </div>
        <div>
          <label className="form-label" htmlFor="edit-festival-image">Image URL</label>
          <input
            id="edit-festival-image"
            className={`form-input ${isImageInvalid ? formStyles.invalid : ''}`}
            value={image}
            onChange={e => setImage(e.target.value)}
            placeholder="https://..."
            aria-invalid={Boolean(isImageInvalid)}
          />
          {isImageInvalid && <p className="form-error">This image host is not allowed. The image won&apos;t display.</p>}
        </div>
        <div>
          <label className="form-label" htmlFor="edit-festival-lineup">Lineup (comma-separated)</label>
          <textarea
            id="edit-festival-lineup"
            className="form-input"
            rows={LINEUP_ROWS}
            value={lineupLoading ? 'Loading lineup…' : lineup}
            onChange={e => setLineup(e.target.value)}
            placeholder="Artist 1, Artist 2, …"
            disabled={lineupLoading}
          />
        </div>
      </div>
      <SheetActions>
        <button type="button" onClick={onClose} className="btn">Cancel</button>
        <button type="button" onClick={handleSave} onPointerDown={keepKeyboardOpenOnTap} className="btn btn-primary">
          {saved ? 'Saved' : 'Save changes'}
        </button>
      </SheetActions>
    </Sheet>
  )
}
