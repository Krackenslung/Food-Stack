import type { TFunction } from 'i18next'
import { ApiError } from '../../lib/api-client'
import type { OrderStatus } from '../../lib/api/types'
import type { CartIngredient } from '../cart/cartStore'

/** Translate an API error from its stable errorCode, never from errorMessage. */
export function apiErrorMessage(error: unknown, t: TFunction): string {
  const code = error instanceof ApiError ? error.errorCode : 'default'
  const key = `errors.${code}`
  return t(key, { defaultValue: t('errors.default') })
}

/** "No onions", "Add guacamole", "Extra cheese ×2" — only what differs from the default recipe. */
export function describeChanges(ingredients: CartIngredient[], t: TFunction): string[] {
  const changes: string[] = []
  for (const { name, quantity, default: included } of ingredients) {
    if (quantity === included) continue
    if (quantity === 0) changes.push(t('cart.changes.no', { name }))
    else if (quantity < included) changes.push(t('cart.changes.less', { name }))
    else if (included === 0) {
      changes.push(
        quantity > 1
          ? t('cart.changes.addMany', { name, count: quantity })
          : t('cart.changes.add', { name }),
      )
    } else {
      const extra = quantity - included
      changes.push(
        extra > 1
          ? t('cart.changes.extraMany', { name, count: extra })
          : t('cart.changes.extra', { name }),
      )
    }
  }
  return changes
}

export const ACTIVE_STATUSES: OrderStatus[] = ['pending_payment', 'received', 'preparing', 'ready']

export const isActiveStatus = (status: OrderStatus) => ACTIVE_STATUSES.includes(status)

/** Page numbers with ellipses: 1 2 3 … 5. */
export function pageList(page: number, totalPages: number): (number | 'gap')[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
  const pages = new Set([1, 2, totalPages - 1, totalPages, page - 1, page, page + 1])
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b)
  const result: (number | 'gap')[] = []
  sorted.forEach((p, index) => {
    if (index > 0 && p - sorted[index - 1] > 1) result.push('gap')
    result.push(p)
  })
  return result
}

/** Password guidance meter (0-4). The backend remains the authority on what is accepted. */
export function passwordStrength(password: string): number {
  return [
    password.length >= 8,
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
    /[a-z]/.test(password) && /[A-Z]/.test(password),
  ].filter(Boolean).length
}

/** "23:00" -> "11:00 PM". */
export function formatHour(hhmm: string): string {
  const [hours, minutes] = hhmm.split(':').map(Number)
  const suffix = hours >= 12 ? 'PM' : 'AM'
  const hour12 = hours % 12 === 0 ? 12 : hours % 12
  return `${hour12}:${String(minutes).padStart(2, '0')} ${suffix}`
}
