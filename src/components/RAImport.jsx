import React, { useState, useCallback } from 'react'
import { useUserData } from '../context/UserDataContext'

/** Try multiple candidate keys in priority order, supports dot-notation */
function pick(obj, ...keys) {
  for (const k of keys) {
    const parts = k.split('.')
    let v = obj
    for (const p of parts) v = v?.[p]
    if (v !== undefined && v !== null && v !== '') return v
  }
  return undefined
}

/** Normalise a date string to YYYY-MM-DD */
function normaliseDate(raw) {
  if (!raw) return null
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10)
  const d = new Date(raw)
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  return raw
}

/** Parse a JSONL file and return an array of objects */
function parseJSONL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const lines = e.target.result.split('\n').map(l => l.trim()).filter(Boolean)
        resolve(lines.map((line, i) => {
          try { return JSON.parse(line) }
          catch { console.warn(`Skipping malformed line ${i + 1}`); return null }
        }).filter(Boolean))
      } catch (err) { reject(err) }
    }
    reader.onerror = reject
    reader.readAsText(file)
  })
}

/** Build normalised event objects from raw RA scraper rows */
function normaliseEvents(eventRows, lineupRows) {
  // Build lineup map: rawId → string[]
  const lineupMap = {}
  lineupRows.forEach(item => {
    const eventKey = String(pick(item, 'eventId', 'event_id', 'id', 'raEventId') ?? '')
    if (!eventKey) return
    if (!lineupMap[eventKey]) lineupMap[eventKey] = []

    const arr = pick(item, 'lineup', 'artists', 'lineup_artists')
    if (Array.isArray(arr)) {
      arr.forEach(a => {
        const name = typeof a === 'string' ? a : pick(a, 'name', 'artistName', 'title')
        if (name) lineupMap[eventKey].push(name)
      })
      return
    }
    const name = pick(item, 'artist', 'name', 'artistName', 'artist_name', 'title')
    if (name) lineupMap[eventKey].push(name)
  })

  const result = {}
  let skipped = 0

  eventRows.forEach(item => {
    const rawId = String(pick(item, 'id', 'eventId', 'ra_id', 'raId', 'slug') ?? '')
    const name = pick(item, 'title', 'name', 'eventTitle', 'event_title', 'eventName')
    if (!name) { skipped++; return }

    const id = `ra-${rawId.replace(/^ra-/, '')}`

    const dateRaw = pick(item,
      'date', 'startDate', 'start_date', 'eventDate', 'event_date',
      'date_start', 'dateStart', 'datetime')

    const venueName = pick(item, 'venue', 'venueName', 'venue_name', 'venue.name', 'location')
    const venueCity = pick(item, 'city', 'venueCity', 'venue_city', 'venue.city', 'venue.address.city')
    const link = pick(item, 'link', 'url', 'contentUrl', 'ra_url', 'href', 'eventUrl')

    // Lineup: from map, or inline array, or single artist field
    let lineup = lineupMap[rawId] ?? []
    if (!lineup.length) {
      const inlineLineup = pick(item, 'lineup', 'artists', 'lineup_artists', 'performers')
      if (Array.isArray(inlineLineup)) {
        lineup = inlineLineup.map(a =>
          typeof a === 'string' ? a : pick(a, 'name', 'artistName', 'title') ?? ''
        ).filter(Boolean)
      }
    }
    if (!lineup.length) {
      const artist = pick(item, 'artist', 'headliner', 'main_act')
      if (artist) lineup = [artist]
    }
    lineup = [...new Set(lineup.map(s => String(s).trim()).filter(Boolean))]

    result[id] = {
      id,
      name,
      date: normaliseDate(dateRaw),
      venue: { name: venueName ?? 'Unknown Venue', city: venueCity ?? '' },
      lineup,
      link: link ?? null,
      source: 'ra',
    }
  })

  return { events: result, skipped }
}

// ─── Additional Import Ideas ───────────────────────────────────────────────────
const IMPORT_IDEAS = [
  {
    icon: '📅',
    title: 'ICS / iCal Import',
    description: 'Download a festival\'s Google Calendar or iCal feed and parse the .ics file directly in the browser.',
    status: 'idea',
  },
  {
    icon: '🎵',
    title: 'Songkick Attendance Export',
    description: 'Songkick lets you export your tracked concerts. Import their CSV to bulk-add your history.',
    status: 'idea',
  },
  {
    icon: '📝',
    title: 'CSV Template Import',
    description: 'Fill in a downloadable CSV template (Name, Date, Venue, City, Artists) and re-upload it.',
    status: 'idea',
  },
  {
    icon: '✏️',
    title: 'Quick Manual Add',
    description: 'A simple form to add one-off events: name, date, venue, and comma-separated lineup.',
    status: 'idea',
  },
  {
    icon: '🎤',
    title: 'Bandsintown Tracker',
    description: 'Bandsintown\'s API exposes your tracked events. Authenticate and pull them in automatically.',
    status: 'idea',
  },
  {
    icon: '🔁',
    title: 'Full JSON Restore',
    description: 'Re-import a previously exported Festival Tracker JSON backup to restore all your data.',
    status: 'idea',
  },
]

// ─── Component ────────────────────────────────────────────────────────────────
export default function RAImport() {
  const { batchImportRA, raEvents } = useUserData()
  const [files, setFiles] = useState({ events: null, lineups: null })
  const [status, setStatus] = useState({ type: '', message: '' })
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState(null)   // { events, skipped } before committing
  const [tab, setTab] = useState('ra')           // 'ra' | 'ideas'

  const handleFileChange = (e, type) => {
    const file = e.target.files[0]
    if (file) {
      setFiles(prev => ({ ...prev, [type]: file }))
      setPreview(null)
      setStatus({ type: '', message: '' })
    }
  }

  /** Step 1: parse and show preview */
  const handleParse = async () => {
    if (!files.events) {
      setStatus({ type: 'error', message: 'Please select at least the EventItem.jsonl file.' })
      return
    }
    setLoading(true)
    setStatus({ type: '', message: '' })
    try {
      const eventData   = await parseJSONL(files.events)
      const lineupData  = files.lineups ? await parseJSONL(files.lineups) : []
      const { events, skipped } = normaliseEvents(eventData, lineupData)

      // Calculate duplicates
      const alreadyPresent = Object.keys(events).filter(k => raEvents[k]).length
      setPreview({ events, skipped, alreadyPresent, lineupCount: lineupData.length })
    } catch (err) {
      console.error('Parse failed:', err)
      setStatus({ type: 'error', message: 'Failed to parse files. Ensure they are valid JSONL.' })
    } finally {
      setLoading(false)
    }
  }

  /** Step 2: commit to state */
  const handleImport = () => {
    if (!preview) return
    batchImportRA(preview.events)
    const newCount = Object.keys(preview.events).length - preview.alreadyPresent
    setStatus({
      type: 'success',
      message: `Imported ${Object.keys(preview.events).length} events (${newCount} new, ${preview.alreadyPresent} updated). They're now searchable on the Discover page!`,
    })
    setPreview(null)
    setFiles({ events: null, lineups: null })
  }

  const resetPreview = () => {
    setPreview(null)
    setStatus({ type: '', message: '' })
  }

  return (
    <div className="import-section fade-in">
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '1px solid var(--border)' }}>
        {[
          { key: 'ra', label: '📦  Import RA Data' },
          { key: 'ideas', label: '💡  More Ways to Import' },
        ].map(t => (
          <button
            key={t.key}
            className="btn-ghost"
            style={{
              padding: '10px 18px',
              fontWeight: tab === t.key ? 700 : 400,
              borderBottom: tab === t.key ? '2px solid var(--accent)' : '2px solid transparent',
              borderRadius: 0,
              color: tab === t.key ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontSize: '0.88rem',
            }}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── RA Import Tab ── */}
      {tab === 'ra' && (
        <>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 24 }}>
            Upload the <code>.jsonl</code> files generated by <code>ra-scraper</code> to expand your event database.
            Or use the seed script in <code>scripts/seed-ra-events.js</code> to bake them in permanently.
          </p>

          {/* File pickers */}
          {!preview && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                <div className={`import-dropzone ${files.events ? 'active' : ''}`} style={{ padding: '20px 10px' }}>
                  <label style={{ cursor: 'pointer', display: 'block' }}>
                    <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>📄</div>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                      {files.events ? files.events.name : 'EventItem.jsonl'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(Required)</div>
                    <input type="file" accept=".jsonl,.json" onChange={e => handleFileChange(e, 'events')} style={{ display: 'none' }} />
                  </label>
                </div>

                <div className={`import-dropzone ${files.lineups ? 'active' : ''}`} style={{ padding: '20px 10px' }}>
                  <label style={{ cursor: 'pointer', display: 'block' }}>
                    <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>👥</div>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                      {files.lineups ? files.lineups.name : 'EventLineupItem.jsonl'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(Optional)</div>
                    <input type="file" accept=".jsonl,.json" onChange={e => handleFileChange(e, 'lineups')} style={{ display: 'none' }} />
                  </label>
                </div>
              </div>

              <button
                className="btn btn-primary"
                onClick={handleParse}
                disabled={loading || !files.events}
                style={{ width: '100%' }}
                id="parse-ra-btn"
              >
                {loading ? 'Parsing…' : 'Preview Import'}
              </button>
            </>
          )}

          {/* Preview step */}
          {preview && (
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-hover)',
              borderRadius: 12,
              padding: '20px 24px',
              marginBottom: 16,
            }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.1rem', marginBottom: 16 }}>
                📊 Import Preview
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
                {[
                  { label: 'Events found', value: Object.keys(preview.events).length, color: 'var(--accent)' },
                  { label: 'Already in app', value: preview.alreadyPresent, color: '#fbbf24' },
                  { label: 'Artists parsed', value: preview.lineupCount, color: '#34d399' },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: 'center', padding: '12px 8px', background: 'var(--bg-surface)', borderRadius: 8 }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.6rem', color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Sample events */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 8 }}>Sample events:</div>
                {Object.values(preview.events).slice(0, 4).map(ev => (
                  <div key={ev.id} style={{ fontSize: '0.82rem', padding: '6px 0', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontWeight: 600 }}>{ev.name}</span>
                    {ev.date && <span style={{ color: 'var(--text-muted)' }}>· {ev.date}</span>}
                    {ev.venue?.city && <span style={{ color: 'var(--text-muted)' }}>· {ev.venue.city}</span>}
                    {ev.lineup.length > 0 && (
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                        ({ev.lineup.slice(0, 3).join(', ')}{ev.lineup.length > 3 ? ` +${ev.lineup.length - 3}` : ''})
                      </span>
                    )}
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  className="btn btn-primary"
                  onClick={handleImport}
                  style={{ flex: 1 }}
                  id="confirm-ra-import-btn"
                >
                  ✅ Confirm Import
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={resetPreview}
                  id="cancel-ra-import-btn"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Status message */}
          {status.message && (
            <div className={`import-status ${status.type}`} style={{ marginTop: 12 }}>
              {status.type === 'success' ? '✅' : '❌'} {status.message}
            </div>
          )}

          {/* Instructions */}
          <div className="import-instructions" style={{ marginTop: 20 }}>
            <strong>Two ways to import:</strong>
            <ol style={{ paddingLeft: 20, marginTop: 8 }}>
              <li>
                <strong>Browser (above):</strong> select your <code>.jsonl</code> files → preview → confirm. Events are saved in your browser and searchable immediately.
              </li>
              <li>
                <strong>Seed script (permanent):</strong> bakes events permanently into the app so they load for everyone:
                <pre style={{ background: 'var(--bg-surface)', borderRadius: 6, padding: '10px 14px', marginTop: 8, fontSize: '0.78rem', overflowX: 'auto', color: 'var(--text-secondary)' }}>
{`node scripts/seed-ra-events.js \\
  --events "path/to/EventItem.jsonl" \\
  --lineups "path/to/EventLineupItem.jsonl"`}
                </pre>
              </li>
            </ol>
          </div>
        </>
      )}

      {/* ── More Import Ideas Tab ── */}
      {tab === 'ideas' && (
        <div>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 24 }}>
            Other ways to get your event history into Festival Tracker. Vote or request a feature if one of these interests you!
          </p>
          <div style={{ display: 'grid', gap: 12 }}>
            {IMPORT_IDEAS.map(idea => (
              <div key={idea.title} style={{
                display: 'flex',
                gap: 16,
                alignItems: 'flex-start',
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: '16px 20px',
                transition: 'border-color 200ms',
              }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-hover)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                <div style={{ fontSize: '1.8rem', lineHeight: 1, flexShrink: 0 }}>{idea.icon}</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 4 }}>{idea.title}</div>
                  <div style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{idea.description}</div>
                </div>
                <div style={{ marginLeft: 'auto', flexShrink: 0, alignSelf: 'center' }}>
                  <span style={{
                    fontSize: '0.7rem',
                    padding: '3px 8px',
                    borderRadius: 20,
                    background: 'rgba(139,92,246,0.15)',
                    color: 'var(--accent)',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}>idea</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
