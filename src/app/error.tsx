'use client'

import PageMessage from '@/components/PageMessage'

export default function Error({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <PageMessage isAlert title="Something went wrong." text="This page couldn't load. Try again, or refresh the page.">
      <button type="button" className="btn btn-primary" onClick={reset}>Try again</button>
    </PageMessage>
  )
}
