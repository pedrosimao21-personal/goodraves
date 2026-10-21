'use client'

import { useState } from 'react'
import { useUserData } from '../context/UserDataContext'
import { isAllowedImageHost } from '../lib/imageHosts'
import { keepKeyboardOpenOnTap } from '../lib/touch-tap'
import Sheet, { SheetActions } from './Sheet'
import formStyles from '@/app/dashboard/_components/DashboardForms.module.css'

const SUCCESS_TOAST_DELAY_MS = 1200
const LINEUP_ROWS = 3

/** Sheet for adding an event that isn't in the database; it lands in the attended list. */
export default function AddCustomEvent({ onClose }: { onClose: () => void }) {
  const { addCustomFestival } = useUserData()
  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [venueName, setVenueName] = useState('')
  const [city, setCity] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [lineupText, setLineupText] = useState('')
  const [saved, setSaved] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    if (!isAllowedImageHost(imageUrl)) return

    const meta = {
      name: name.trim(),
      date: date || null,
      venue: {
        name: venueName.trim() || null,
        city: city.trim() || null,
      },
      image: imageUrl.trim() || null,
    }

    const lineup = lineupText
      .split(/[,\n]+/)
      .map(s => s.trim())
      .filter(Boolean)
      .map(artistName => ({
        id: 'artist-' + artistName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        name: artistName,
      }))

    addCustomFestival(meta, lineup)
    setSaved(true)
    setTimeout(onClose, SUCCESS_TOAST_DELAY_MS)
  }

  const isImageInvalid = Boolean(imageUrl) && !isAllowedImageHost(imageUrl)

  if (saved) {
    return (
      <Sheet title="Event added" onClose={onClose}>
        <p className="form-hint" role="status">It&apos;s now in your attended list.</p>
      </Sheet>
    )
  }

  return (
    <Sheet title="Add event" eyebrow="Not in the database" onClose={onClose}>
      <form id="add-custom-event" onSubmit={handleSubmit} className="form-stack">
        <p className="form-hint">
          Add an event or rave that isn&apos;t in the database. It shows up in your attended list, timeline and insights.
        </p>
        <div>
          <label className="form-label" htmlFor="custom-event-name">Event name *</label>
          <input id="custom-event-name" className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Awakenings Spring Event" required />
        </div>
        <div>
          <label className="form-label" htmlFor="custom-event-date">Date</label>
          <input id="custom-event-date" type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div className={formStyles.pair}>
          <div>
            <label className="form-label" htmlFor="custom-event-venue">Venue</label>
            <input id="custom-event-venue" className="form-input" value={venueName} onChange={e => setVenueName(e.target.value)} placeholder="e.g. Gashouder" />
          </div>
          <div>
            <label className="form-label" htmlFor="custom-event-city">City</label>
            <input id="custom-event-city" className="form-input" value={city} onChange={e => setCity(e.target.value)} placeholder="e.g. Amsterdam" />
          </div>
        </div>
        <div>
          <label className="form-label" htmlFor="custom-event-image">Image URL</label>
          <input
            id="custom-event-image"
            className={`form-input ${isImageInvalid ? formStyles.invalid : ''}`}
            value={imageUrl}
            onChange={e => setImageUrl(e.target.value)}
            placeholder="https://example.com/fest-image.jpg"
            aria-invalid={isImageInvalid}
          />
          {isImageInvalid && <p className="form-error">This image host is not allowed. The image won&apos;t display.</p>}
        </div>
        <div>
          <label className="form-label" htmlFor="custom-event-lineup">Lineup (comma or newline separated)</label>
          <textarea
            id="custom-event-lineup"
            className="form-input"
            rows={LINEUP_ROWS}
            value={lineupText}
            onChange={e => setLineupText(e.target.value)}
            placeholder={'Amelie Lens, Charlotte de Witte\nAdam Beyer, Ben Klock'}
          />
        </div>
      </form>
      <SheetActions>
        <button type="button" onClick={onClose} className="btn">Cancel</button>
        <button type="submit" form="add-custom-event" className="btn btn-primary" onPointerDown={keepKeyboardOpenOnTap}>Add event</button>
      </SheetActions>
    </Sheet>
  )
}
