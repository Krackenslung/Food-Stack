import type { Role } from '../../lib/auth'

/** Where each role lands after signing in. */
export const HOME_BY_ROLE: Record<Role, string> = {
  customer: '/',
  staff: '/kitchen',
  admin: '/admin',
}
