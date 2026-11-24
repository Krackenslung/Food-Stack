import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { applyTheme, readStoredTheme, resolveTheme, storeTheme } from '../../lib/theme'
import type { ResolvedTheme, ThemePreference } from '../../lib/theme'

type ThemeContextValue = {
  preference: ThemePreference
  resolved: ResolvedTheme
  setPreference: (preference: ThemePreference) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const DARK_QUERY = '(prefers-color-scheme: dark)'

function systemPrefersDark(): boolean {
  return (
    typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(DARK_QUERY).matches
  )
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(
    () => readStoredTheme() ?? 'system',
  )
  const [systemDark, setSystemDark] = useState(systemPrefersDark)

  useEffect(() => {
    if (!window.matchMedia) return
    const list = window.matchMedia(DARK_QUERY)
    const onChange = () => setSystemDark(list.matches)
    list.addEventListener('change', onChange)
    return () => list.removeEventListener('change', onChange)
  }, [])

  const resolved = resolveTheme(preference, systemDark)

  useEffect(() => {
    applyTheme(resolved)
  }, [resolved])

  const setPreference = useCallback((next: ThemePreference) => {
    storeTheme(next)
    setPreferenceState(next)
  }, [])

  const value = useMemo(
    () => ({ preference, resolved, setPreference }),
    [preference, resolved, setPreference],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used inside <ThemeProvider>')
  return context
}
