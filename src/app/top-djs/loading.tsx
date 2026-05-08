export default function Loading() {
  return (
    <div className="page">
      <div className="container">
        <div className="skeleton" style={{ height: 48, borderRadius: 8, marginBottom: 24, maxWidth: 300 }} />
        <div className="grid">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton skeleton-card" />
          ))}
        </div>
      </div>
    </div>
  )
}
