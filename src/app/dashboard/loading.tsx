export default function Loading() {
  return (
    <div className="page">
      <div className="container">
        <div className="grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton skeleton-card" />
          ))}
        </div>
      </div>
    </div>
  )
}
