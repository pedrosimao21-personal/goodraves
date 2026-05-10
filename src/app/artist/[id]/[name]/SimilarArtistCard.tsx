'use client'

import Link from 'next/link'
import Image from 'next/image'

export function SimilarArtistCard({
  artistName,
  image,
  href,
  onClick,
}: {
  artistName: string
  image: string | null
  href?: string
  onClick?: () => void
}) {
  const elementId = `related-${artistName.replace(/\s+/g, '-').toLowerCase()}`

  const inner = (
    <>
      {image ? (
        <Image className="related-artist-img" src={image} alt={artistName} width={80} height={80} quality={90} sizes="80px" style={{ objectFit: 'cover' }} />
      ) : (
        <div className="related-artist-img-placeholder">🎤</div>
      )}
      <span className="related-artist-name">{artistName}</span>
    </>
  )

  if (href) {
    return (
      <Link href={href} className="related-artist-card" id={elementId}>
        {inner}
      </Link>
    )
  }

  return (
    <button className="related-artist-card" onClick={onClick} id={elementId}>
      {inner}
    </button>
  )
}
