import { Navigate, Outlet, useLocation } from 'react-router-dom'
import type { Role } from '../lib/auth'
import { useAuth } from './providers/AuthProvider'

/**
 * Route guard. Anonymous users go to /login (remembering where they were heading);
 * logged-in users without a matching role go home. The backend still enforces roles:
 * this only avoids showing screens that would just fail.
 */
export function RequireRole({ roles }: { roles: Role[] }) {
  const { user, status } = useAuth()
  const location = useLocation()

  if (status === 'loading') return null
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (!roles.includes(user.role)) return <Navigate to="/" replace />

  return <Outlet />
}
