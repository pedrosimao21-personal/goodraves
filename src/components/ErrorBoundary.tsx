'use client'

import React from 'react'
import PageMessage from './PageMessage'
import styles from './PageMessage.module.css'

type State = { hasError: boolean; error: Error | null; errorInfo: React.ErrorInfo | null }

const IS_DEVELOPMENT = process.env.NODE_ENV === 'development'

export default class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo)
    this.setState({ errorInfo })
  }

  render() {
    if (!this.state.hasError) return this.props.children

    const goHome = () => {
      this.setState({ hasError: false, error: null, errorInfo: null })
      window.location.href = '/'
    }

    return (
      <PageMessage isAlert title="Something went wrong." text="This page hit an unexpected error while rendering. If it keeps happening, refresh the page.">
        <button type="button" className="btn btn-primary" onClick={goHome}>Back to Discover</button>
        {IS_DEVELOPMENT && (
          <div className={styles.details}>
            <p className={`mono ${styles.detailsError}`}>{this.state.error?.toString()}</p>
            <pre className={styles.detailsStack}>{this.state.errorInfo?.componentStack}</pre>
          </div>
        )}
      </PageMessage>
    )
  }
}
