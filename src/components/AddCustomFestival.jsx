import { useState } from 'react'
import { useUserData } from '../context/UserDataContext'

export default function AddCustomFestival({ onClose }) {
  const { addCustomFestival } = useUserData()
  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [venueName, setVenueName] = useState('')
  const [city, setCity] = useState('')
  const [genre, setGenre] = useState('')
  const [lineupText, setLineupText] = useState('')
  const [saved, setSaved] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name.trim()) return

    const meta = {
      name: name.trim(),
      date: date || null,
      venue: {
        name: venueName.trim() || null,
        city: city.trim() || null,
      },
      genre: genre.trim() || null,
      image: null,
    }

    // Parse lineup: comma or newline separated
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
    setTimeout(() => {
      onClose?.()
    }, 1200)
  }

  if (saved) {
    return (
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid rgba(16, 185, 129, 0.4)',
        borderRadius: 16,
        padding: '32px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🎉</div>
        <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 4 }}>Festival Added!</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>It's now in your attended list.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 16,
      padding: '24px',
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.2rem', margin: 0 }}>
          ✨ Add Custom Festival
        </h3>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            fontSize: '1.2rem',
            cursor: 'pointer',
            padding: '4px 8px',
          }}
        >
          ✕
        </button>
      </div>

      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0, lineHeight: 1.5 }}>
        Add festivals or raves that aren't in the database. They'll appear in your attended list, timeline, and insights.
      </p>

      {/* Name */}
      <div>
        <label style={labelStyle}>Event Name *</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Awakenings Spring Festival"
          required
          style={inputStyle}
        />
      </div>

      {/* Date */}
      <div>
        <label style={labelStyle}>Date</label>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          style={inputStyle}
        />
      </div>

      {/* Venue & City */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={labelStyle}>Venue</label>
          <input
            type="text"
            value={venueName}
            onChange={e => setVenueName(e.target.value)}
            placeholder="e.g. Gashouder"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>City</label>
          <input
            type="text"
            value={city}
            onChange={e => setCity(e.target.value)}
            placeholder="e.g. Amsterdam"
            style={inputStyle}
          />
        </div>
      </div>

      {/* Genre */}
      <div>
        <label style={labelStyle}>Genre</label>
        <input
          type="text"
          value={genre}
          onChange={e => setGenre(e.target.value)}
          placeholder="e.g. Techno, House, Drum & Bass"
          style={inputStyle}
        />
      </div>

      {/* Lineup */}
      <div>
        <label style={labelStyle}>Lineup (comma or newline separated)</label>
        <textarea
          value={lineupText}
          onChange={e => setLineupText(e.target.value)}
          placeholder={"Amelie Lens, Charlotte de Witte\nAdam Beyer, Ben Klock"}
          rows={3}
          style={{ ...inputStyle, resize: 'vertical', minHeight: 64 }}
        />
      </div>

      <button type="submit" className="btn btn-primary" style={{ marginTop: 4 }}>
        Add Festival
      </button>
    </form>
  )
}

const labelStyle = {
  display: 'block',
  fontSize: '0.8rem',
  fontWeight: 600,
  color: 'var(--text-secondary)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  marginBottom: 6,
}

const inputStyle = {
  width: '100%',
  padding: '12px 14px',
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  color: 'var(--text-primary)',
  fontFamily: 'inherit',
  fontSize: '0.95rem',
  outline: 'none',
  transition: 'border-color 200ms ease',
  boxSizing: 'border-box',
}
