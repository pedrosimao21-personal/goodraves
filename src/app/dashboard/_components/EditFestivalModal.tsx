'use client'

import React, { useState } from 'react'
import { useUserData } from '@/context/UserDataContext'
import { isAllowedImageHost } from '@/lib/imageHosts'

const MODAL_Z_INDEX = 1000
const MODAL_MAX_WIDTH = 480
const IMAGE_ERROR_COLOR = '#f87171'
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
  const [saved, setSaved] = useState(false)

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

  const inputStyle = {
    width: '100%',
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '10px 12px',
    color: 'var(--text-primary)',
    fontSize: '0.9rem',
    fontFamily: 'var(--font-sans)',
    outline: 'none',
    boxSizing: 'border-box' as const,
  }
  const labelStyle = { fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 5, display: 'block' as const, fontWeight: 600 }

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: MODAL_Z_INDEX,
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-end',
        justifyContent: 'center',
        padding: '0 0 env(safe-area-inset-bottom, 0)',
      }}
    >
      <div
        className="fade-in"
        style={{
          background: 'var(--bg-card)',
          width: '100%', maxWidth: MODAL_MAX_WIDTH,
          borderRadius: '20px 20px 0 0',
          border: '1px solid var(--border)',
          overflow: 'hidden',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem' }}>Edit Festival</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.1rem', cursor: 'pointer', padding: '4px 8px' }}>&times;</button>
        </div>

        <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>Event Name</label>
            <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Date</label>
            <input type="date" style={inputStyle} value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div className="form-grid">
            <div>
              <label style={labelStyle}>Venue</label>
              <input style={inputStyle} value={venue} onChange={e => setVenue(e.target.value)} placeholder="e.g. Gashouder" />
            </div>
            <div>
              <label style={labelStyle}>City</label>
              <input style={inputStyle} value={city} onChange={e => setCity(e.target.value)} placeholder="e.g. Amsterdam" />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Image URL</label>
            <input
              style={{ ...inputStyle, borderColor: isImageInvalid ? IMAGE_ERROR_COLOR : undefined }}
              value={image}
              onChange={e => setImage(e.target.value)}
              placeholder="https://..."
            />
            {isImageInvalid && (
              <p style={{ margin: '6px 0 0', fontSize: '0.78rem', color: IMAGE_ERROR_COLOR }}>
                This image host is not allowed. The image won&apos;t display.
              </p>
            )}
          </div>
          <div>
            <label style={labelStyle}>Lineup (comma-separated)</label>
            <textarea
              style={{ ...inputStyle, resize: 'vertical', minHeight: 72 }}
              value={lineup}
              onChange={e => setLineup(e.target.value)}
              placeholder="Artist 1, Artist 2, ..."
            />
          </div>
        </div>

        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, flexShrink: 0 }}>
          <button onClick={onClose} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
          <button onClick={handleSave} className="btn btn-primary" style={{ flex: 2 }}>
            {saved ? 'Saved!' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
