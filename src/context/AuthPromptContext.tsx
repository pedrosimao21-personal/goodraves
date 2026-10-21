'use client'

import React, { createContext, useContext, useState, useCallback } from 'react'
import Link from 'next/link'
import Sheet, { SheetActions } from '@/components/Sheet'

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
        <Sheet title="Account required" onClose={() => setOpen(false)}>
          <p className="form-hint">Log in to do that. It takes a username and a password, nothing else.</p>
          <SheetActions>
            <Link href="/register" className="btn" onClick={() => setOpen(false)}>Create account</Link>
            <Link href="/login" className="btn btn-primary" onClick={() => setOpen(false)}>Log in</Link>
          </SheetActions>
        </Sheet>
      )}
    </AuthPromptContext.Provider>
  )
}
