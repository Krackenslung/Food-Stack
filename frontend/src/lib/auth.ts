import type { Language } from './language'
import { normalizeLanguage } from './language'
import { isThemePreference } from './theme'
import type { ThemePreference } from './theme'

export type Role = 'customer' | 'staff' | 'admin'

export type SessionUser = {
  id: number
  name: string
  lastname: string
  email: string
  role: Role
  preferredLanguage: Language | null
  preferredTheme: ThemePreference | null
}

const ROLES: Role[] = ['customer', 'staff', 'admin']

function pick(raw: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) if (raw[key] !== undefined && raw[key] !== null) return raw[key]
  return undefined
}

/**
 * GET /api/session returns the user row today (snake_case, possibly wrapped in { user })
 * and camelCase { user } in the target contract. Accept both.
 */
export function normalizeUser(payload: unknown): SessionUser | null {
  if (typeof payload !== 'object' || payload === null) return null
  const container = payload as Record<string, unknown>
  const raw = (
    typeof container.user === 'object' && container.user !== null ? container.user : container
  ) as Record<string, unknown>

  const role = String(pick(raw, 'role') ?? '').toLowerCase() as Role
  const id = Number(pick(raw, 'id'))
  if (!ROLES.includes(role) || !Number.isFinite(id) || id <= 0) return null

  const theme = pick(raw, 'preferredTheme', 'preferred_theme')

  return {
    id,
    name: String(pick(raw, 'name') ?? ''),
    lastname: String(pick(raw, 'lastname', 'lastName') ?? ''),
    email: String(pick(raw, 'email') ?? ''),
    role,
    preferredLanguage: normalizeLanguage(
      String(pick(raw, 'preferredLanguage', 'preferred_language') ?? ''),
    ),
    preferredTheme: isThemePreference(theme) ? theme : null,
  }
}

export function initialsOf(user: Pick<SessionUser, 'name' | 'lastname'> | null): string {
  if (!user) return ''
  return (
    `${user.name.charAt(0)}${user.lastname.charAt(0)}`.toUpperCase() ||
    user.name.charAt(0).toUpperCase()
  )
}
