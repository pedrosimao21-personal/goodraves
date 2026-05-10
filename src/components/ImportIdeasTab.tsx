'use client'

import React from 'react'

type ImportIdea = {
  icon: string
  title: string
  description: string
  status: string
}

const IMPORT_IDEAS: ImportIdea[] = [
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

export default function ImportIdeasTab() {
  return (
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
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border-hover)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
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
  )
}
