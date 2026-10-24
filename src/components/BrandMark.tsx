import styles from './BrandMark.module.css'

/**
 * The Goodraves mark: three faders on a tile. The same drawing as
 * public/icon.svg (scripts/generate-brand-icons.mjs), but themed: lime tile
 * with dark faders on dark, the reverse on light.
 */
export default function BrandMark({ className }: { className?: string }) {
  return (
    <svg className={`${styles.mark} ${className ?? ''}`} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect className={styles.tile} width="32" height="32" />
      <g className={styles.faders}>
        <rect x="6.75" y="5" width="2.5" height="22" />
        <rect x="4.5" y="18" width="7" height="6" />
        <rect x="14.75" y="5" width="2.5" height="22" />
        <rect x="12.5" y="7" width="7" height="6" />
        <rect x="22.75" y="5" width="2.5" height="22" />
        <rect x="20.5" y="12" width="7" height="6" />
      </g>
    </svg>
  )
}
