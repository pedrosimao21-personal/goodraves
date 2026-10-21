'use client'

import { useState } from 'react'
import { CheckIcon, ShareIcon } from '@/components/icons'

const COPIED_FEEDBACK_DELAY_MS = 2000

/** Icon button: the native share sheet where there is one, else copies the link. */
export default function ShareFestivalButton({ name, date, venue, className = '' }: {
  name: string
  date?: string | null
  venue?: string | null
  className?: string
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

  const label = copied ? 'Link copied' : 'Share festival'
  return (
    <button type="button" onClick={handleShare} className={`btn btn-icon ${className}`} aria-label={label} title={label}>
      {copied ? <CheckIcon size={18} strokeWidth={2} /> : <ShareIcon size={18} />}
    </button>
  )
}
