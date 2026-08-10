'use client'

import { useState } from 'react'

const COPIED_FEEDBACK_DELAY_MS = 2000

function ShareIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
    </svg>
  )
}

export default function ShareFestivalButton({ name, date, venue }: {
  name: string
  date?: string | null
  venue?: string | null
}) {
  const [copied, setCopied] = useState(false)

  const handleShare = async () => {
    const url = window.location.href
    const text = [name, date, venue].filter(Boolean).join(' · ')

    if (navigator.share) {
      try {
        await navigator.share({ title: name, text, url })
      } catch {
        // User cancelled the native share sheet — not an error, nothing to fall back to.
      }
      return
    }

    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), COPIED_FEEDBACK_DELAY_MS)
    } catch {
      // Clipboard access denied — nothing more we can do without user interaction.
    }
  }

  return (
    <button onClick={handleShare} className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <ShareIcon /> {copied ? 'Link copied!' : 'Share'}
    </button>
  )
}
