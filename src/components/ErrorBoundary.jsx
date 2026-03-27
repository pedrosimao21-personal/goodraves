import React from 'react'
import { Link } from 'react-router-dom'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo)
    this.setState({ errorInfo })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="page" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', padding: 20 }}>
          <div style={{ fontSize: '4rem', marginBottom: 16 }}>💥</div>
          <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: 8, color: 'var(--text)' }}>Something went wrong!</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: 24, textAlign: 'center', maxWidth: 600 }}>
            The application encountered an unexpected error while rendering this page.
          </p>
          <div style={{ background: 'var(--bg-card)', padding: 16, borderRadius: 8, width: '100%', maxWidth: 800, overflowX: 'auto', marginBottom: 24, border: '1px solid var(--border)' }}>
            <p style={{ color: '#ef4444', fontWeight: 'bold', marginBottom: 10 }}>{this.state.error && this.state.error.toString()}</p>
            <pre style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
              {this.state.errorInfo && this.state.errorInfo.componentStack}
            </pre>
          </div>
          <button 
            className="btn btn-primary"
            onClick={() => {
              this.setState({ hasError: false, error: null, errorInfo: null })
              window.location.href = '/'
            }}
          >
            Go Back Home
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
