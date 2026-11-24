import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { I18nextProvider } from 'react-i18next'
import i18n from '../../lib/i18n'
import { normalizeLanguage, storeLanguage } from '../../lib/language'
import type { Language } from '../../lib/language'

type LanguageContextValue = {
  language: Language
  setLanguage: (language: Language) => void
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(
    () => normalizeLanguage(i18n.language) ?? 'en',
  )

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  const setLanguage = useCallback((next: Language) => {
    storeLanguage(next)
    void i18n.changeLanguage(next)
    setLanguageState(next)
  }, [])

  const value = useMemo(() => ({ language, setLanguage }), [language, setLanguage])

  return (
    <I18nextProvider i18n={i18n}>
      <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
    </I18nextProvider>
  )
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext)
  if (!context) throw new Error('useLanguage must be used inside <LanguageProvider>')
  return context
}
