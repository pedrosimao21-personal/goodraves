import React, { Suspense, lazy } from 'react'
import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import { UserDataProvider } from './context/UserDataContext'
import ErrorBoundary from './components/ErrorBoundary'

const Home = lazy(() => import('./pages/Home'))
const FestivalDetail = lazy(() => import('./pages/FestivalDetail'))
const ArtistDetail = lazy(() => import('./pages/ArtistDetail'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Timeline = lazy(() => import('./pages/Timeline'))
const TopDJs = lazy(() => import('./pages/TopDJs'))
const Insights = lazy(() => import('./pages/Insights'))

/* Minimal spinner used as Suspense fallback — much lighter than a 
   text-heavy message like "Loading maps and metrics…" which showed 
   on every first tab switch even for non-Insights pages. */
function PageLoader() {
  return (
    <div className="container" style={{ paddingTop: 80, textAlign: 'center' }}>
      <div className="loading-spinner" />
    </div>
  )
}

export default function App() {
  return (
    <UserDataProvider>
      <Navbar />
      <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/festival/:id" element={<FestivalDetail />} />
          <Route path="/artist/:name" element={<ArtistDetail />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/timeline" element={<Timeline />} />
          <Route path="/top-djs" element={<TopDJs />} />
          <Route path="/insights" element={<Insights />} />
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
        </Suspense>
      </ErrorBoundary>
    </UserDataProvider>
  )
}
