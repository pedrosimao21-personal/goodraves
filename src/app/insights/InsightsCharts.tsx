import type { CountRow, GenreRow } from './use-insights-data'
import styles from './Insights.module.css'

const PERCENT = 100
// Leaves room above the tallest bar for its count label.
const MAX_BAR_HEIGHT_PERCENT = 82

function maxCount(rows: CountRow[]): number {
  return Math.max(1, ...rows.map(r => r.count))
}

/** Vertical bars per year; the busiest year is lime. Board: Insights. */
export function YearBars({ data }: { data: CountRow[] }) {
  const max = maxCount(data)
  return (
    <div role="img" aria-label={data.map(d => `${d.name}: ${d.count}`).join(', ')}>
      <div className={styles.yearBars} style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}>
        {data.map(d => (
          <div key={d.name} className={styles.yearColumn}>
            <span className="mono">{d.count}</span>
            <div
              className={`${styles.bar} ${d.count === max ? styles.barTop : ''}`}
              style={{ height: `${Math.max((d.count / max) * MAX_BAR_HEIGHT_PERCENT, 1)}%` }}
            />
          </div>
        ))}
      </div>
      <div className={styles.yearLabels} style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}>
        {data.map(d => <span key={d.name} className="mono">{d.name}</span>)}
      </div>
    </div>
  )
}

/** Horizontal bars with the share of sets seen per genre. Board: Insights. */
export function GenreBars({ data }: { data: GenreRow[] }) {
  const max = Math.max(1, ...data.map(d => d.percent))
  return (
    <div className={styles.genreList}>
      {data.map((d, index) => (
        <div key={d.name} className={styles.genreRow}>
          <span className={styles.genreName}>{d.name}</span>
          <div className={styles.track}>
            <div className={`${styles.fill} ${index === 0 ? styles.barTop : ''}`} style={{ width: `${(d.percent / max) * PERCENT}%` }} />
          </div>
          <span className={`mono ${styles.genrePercent}`}>{d.percent}%</span>
        </div>
      ))}
    </div>
  )
}

/** Cities with a thin bar each; the top city is lime. Board: Insights. */
export function CityBars({ data }: { data: CountRow[] }) {
  const max = maxCount(data)
  return (
    <div>
      {data.map((city, index) => (
        <div key={city.name} className={styles.cityRow}>
          <div className={styles.cityHead}>
            <span className={styles.cityName}>{city.name}</span>
            <span className="mono">{city.count}</span>
          </div>
          <div className={styles.thinTrack}>
            <div className={`${styles.fill} ${index === 0 ? styles.barTop : ''}`} style={{ width: `${(city.count / max) * PERCENT}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}
