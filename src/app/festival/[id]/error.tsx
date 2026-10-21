'use client'

import PageMessage from '@/components/PageMessage'

export default function Error({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <PageMessage
      isAlert
      title="Couldn't load this festival."
      text="Something went wrong while loading the festival details. Try again, or refresh the page."
    >
      <button type="button" className="btn btn-primary" onClick={reset}>Try again</button>
    </PageMessage>
  )
}
