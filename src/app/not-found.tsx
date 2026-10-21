import Link from 'next/link'
import PageMessage from '@/components/PageMessage'

export default function NotFound() {
  return (
    <PageMessage eyebrow="404" title="Page not found." text="This page doesn't exist, or the link is out of date.">
      <Link href="/" className="btn btn-primary">Discover festivals</Link>
    </PageMessage>
  )
}
