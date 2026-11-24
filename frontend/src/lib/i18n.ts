import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from '../locales/en.json'
import es from '../locales/es.json'
import { readStoredLanguage, resolveLanguage } from './language'
import type { Language } from './language'

export function initialLanguage(): Language {
  return resolveLanguage({
    stored: readStoredLanguage(),
    navigatorLanguage: typeof navigator === 'undefined' ? null : navigator.language,
  })
}

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, es: { translation: es } },
  lng: initialLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false }, // React already escapes
})

document.documentElement.lang = i18n.language

export default i18n
