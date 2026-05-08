export default function Loading() {
  return (
    <div className="page">
      <div className="container">
        <div className="skeleton" style={{ height: 300, borderRadius: 16, marginBottom: 24 }} />
        <div className="grid">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton skeleton-card" />
          ))}
        </div>
      </div>
    </div>
  )
}
