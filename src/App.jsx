import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import FestivalDetail from './pages/FestivalDetail'
import ArtistDetail from './pages/ArtistDetail'
import Dashboard from './pages/Dashboard'
import Timeline from './pages/Timeline'
import TopDJs from './pages/TopDJs'
import { UserDataProvider } from './context/UserDataContext'
import ErrorBoundary from './components/ErrorBoundary'

export default function App() {
  return (
    <UserDataProvider>
      <Navbar />
      <ErrorBoundary>
        <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/festival/:id" element={<FestivalDetail />} />
        <Route path="/artist/:name" element={<ArtistDetail />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/timeline" element={<Timeline />} />
        <Route path="/top-djs" element={<TopDJs />} />
        <Route path="*" element={
          <div className="page">
            <div className="container" style={{ textAlign: 'center', paddingTop: 80 }}>
              <div style={{ fontSize: '4rem', marginBottom: 16 }}>🎵</div>
              <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: 8 }}>Page Not Found</h2>
              <p style={{ color: 'var(--text-muted)' }}>This page doesn't exist.</p>
            </div>
          </div>
        } />
        </Routes>
      </ErrorBoundary>
    </UserDataProvider>
  )
}
