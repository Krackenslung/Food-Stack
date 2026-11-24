export type Language = 'en' | 'es'

export const LANGUAGES: Language[] = ['en', 'es']
export const LANGUAGE_STORAGE_KEY = 'foodstack-lang'

export function isLanguage(value: unknown): value is Language {
  return value === 'en' || value === 'es'
}

/** "es-MX" / "es_419" -> "es"; unsupported values -> null. */
export function normalizeLanguage(value: string | null | undefined): Language | null {
  const base = String(value ?? '')
    .toLowerCase()
    .split(/[-_]/)[0]
  return isLanguage(base) ? base : null
}

type LanguageSources = {
  stored?: string | null
  userPreference?: string | null
  navigatorLanguage?: string | null
}

/**
 * Order: localStorage['foodstack-lang'] -> user's preferred_language (when logged in)
 * -> navigator.language -> 'en'.
 */
export function resolveLanguage({
  stored,
  userPreference,
  navigatorLanguage,
}: LanguageSources): Language {
  return (
    normalizeLanguage(stored) ??
    normalizeLanguage(userPreference) ??
    normalizeLanguage(navigatorLanguage) ??
    'en'
  )
}

export function readStoredLanguage(): Language | null {
  try {
    return normalizeLanguage(window.localStorage.getItem(LANGUAGE_STORAGE_KEY))
  } catch {
    return null
  }
}

export function storeLanguage(language: Language): void {
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
  } catch {
    /* storage unavailable: the choice just won't persist */
  }
}
