import type { Language } from './language'

const LOCALES: Record<Language, string> = { en: 'en-US', es: 'es-MX' }

/** Currency comes from the backend config (STRIPE_CURRENCY), e.g. "USD". */
export function formatMoney(amount: number | string, language: Language, currency = 'USD'): string {
  return new Intl.NumberFormat(LOCALES[language], { style: 'currency', currency }).format(
    Number(amount),
  )
}

export function formatDateTime(value: Date | string | number, language: Language): string {
  return new Intl.DateTimeFormat(LOCALES[language], {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}
