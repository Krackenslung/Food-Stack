import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { normalizeUser } from '../../lib/auth'
import type { SessionUser } from '../../lib/auth'
import { request, tokenStore } from '../../lib/api-client'
import { api } from '../../lib/api/endpoints'

type AuthStatus = 'loading' | 'authenticated' | 'anonymous'

type AuthContextValue = {
  user: SessionUser | null
  status: AuthStatus
  refresh: () => Promise<SessionUser | null>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')

  const refresh = useCallback(async (): Promise<SessionUser | null> => {
    try {
      const payload = await request('/session')
      const next = normalizeUser(payload)
      setUser(next)
      setStatus(next ? 'authenticated' : 'anonymous')
      return next
    } catch {
      // 401, network error, etc.: treat as logged out. Protected screens redirect to /login.
      setUser(null)
      setStatus('anonymous')
      return null
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.logout()
    } catch {
      /* clear local state regardless */
    }
    tokenStore.clear()
    setUser(null)
    setStatus('anonymous')
  }, [])

  useEffect(() => {
    // Initial session check against the backend (not just localStorage).
    void refresh()
  }, [refresh])

  const value = useMemo(() => ({ user, status, refresh, logout }), [user, status, refresh, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>')
  return context
}
