import styles from './ArtistBody.module.css'

/** Display heading with a mono count or source on the right, over a hairline. */
export default function SectionHeading({ title, meta, size = 'lg' }: { title: string; meta?: string; size?: 'lg' | 'sm' }) {
  return (
    <div className={styles.heading}>
      <h2 className={`display ${size === 'lg' ? styles.headingLarge : styles.headingSmall}`}>{title}</h2>
      {meta && <span className={`mono ${styles.headingMeta}`}>{meta}</span>}
    </div>
  )
}
