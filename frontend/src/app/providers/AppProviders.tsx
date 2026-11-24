import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { readStoredLanguage } from '../../lib/language'
import { readStoredTheme } from '../../lib/theme'
import { AuthProvider, useAuth } from './AuthProvider'
import { LanguageProvider, useLanguage } from './LanguageProvider'
import { ToastProvider } from './ToastProvider'
import { ThemeProvider, useTheme } from './ThemeProvider'

/**
 * When the user logs in, their saved preferences apply only if the device has no explicit
 * choice yet (localStorage wins: it is the first step in both resolution orders).
 */
function PreferenceSync() {
  const { user } = useAuth()
  const { setLanguage } = useLanguage()
  const { setPreference } = useTheme()

  useEffect(() => {
    if (!user) return
    if (user.preferredLanguage && !readStoredLanguage()) setLanguage(user.preferredLanguage)
    if (user.preferredTheme && !readStoredTheme()) setPreference(user.preferredTheme)
  }, [user, setLanguage, setPreference])

  return null
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
      }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <LanguageProvider>
          <AuthProvider>
            <PreferenceSync />
            <ToastProvider>{children}</ToastProvider>
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
