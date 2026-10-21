'use client'

import Link from 'next/link'
import Image from 'next/image'
import styles from './ArtistBody.module.css'

const IMAGE_SIZE = 160

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
      <span className={styles.similarPhoto}>
        {image
          ? <Image src={image} alt="" width={IMAGE_SIZE} height={IMAGE_SIZE} quality={85} sizes="(max-width: 640px) 30vw, 100px" />
          : <span className="display" aria-hidden="true">{artistName[0]}</span>}
      </span>
      <span className={styles.similarName}>{artistName}</span>
    </>
  )

  if (href) {
    return <Link href={href} className={styles.similar} id={elementId}>{inner}</Link>
  }
  return <button type="button" className={styles.similar} onClick={onClick} id={elementId}>{inner}</button>
}
