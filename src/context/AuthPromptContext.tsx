'use client'

import React, { createContext, useContext, useState, useCallback } from 'react'
import Link from 'next/link'

interface AuthPromptContextType {
  promptAuth: () => void
}

const AuthPromptContext = createContext<AuthPromptContextType | null>(null)

export function useAuthPrompt() {
  const ctx = useContext(AuthPromptContext)
  if (!ctx) throw new Error('useAuthPrompt must be used within AuthPromptProvider')
  return ctx
}

export function AuthPromptProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)

  const promptAuth = useCallback(() => setOpen(true), [])

  return (
    <AuthPromptContext.Provider value={{ promptAuth }}>
      {children}
      {open && (
        <div className="auth-prompt-overlay" onClick={() => setOpen(false)}>
          <div className="auth-prompt-modal" onClick={e => e.stopPropagation()}>
            <button className="auth-prompt-close" onClick={() => setOpen(false)} aria-label="Close">&times;</button>
            <h2>Account required</h2>
            <p>You need to be logged in to do that.</p>
            <div className="auth-prompt-actions">
              <Link href="/login" className="auth-prompt-btn auth-prompt-btn-primary" onClick={() => setOpen(false)}>Log In</Link>
              <Link href="/register" className="auth-prompt-btn" onClick={() => setOpen(false)}>Register</Link>
            </div>
          </div>
        </div>
      )}
    </AuthPromptContext.Provider>
  )
}
