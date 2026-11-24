import { NavLink } from 'react-router-dom'
import { Logout } from '../icons'
import type { LucideIcon } from '../icons'
import { Logo } from './Logo'
import './AdminSidebar.css'

export type AdminSidebarItem = {
  to: string
  label: string
  icon: LucideIcon
  /** Count pill, e.g. open orders. */
  badge?: number
  /** Rendered disabled with the "coming soon" label (no backend yet). */
  comingSoon?: boolean
}

export type AdminSidebarGroup = { title: string; items: AdminSidebarItem[] }

type AdminSidebarProps = {
  groups: AdminSidebarGroup[]
  comingSoonLabel: string
  user: { initials: string; name: string; roleLabel: string }
  logoutLabel: string
  onLogout: () => void
}

export function AdminSidebar({
  groups,
  comingSoonLabel,
  user,
  logoutLabel,
  onLogout,
}: AdminSidebarProps) {
  return (
    <aside className="fs-sidebar">
      <div className="fs-sidebar__logo">
        <Logo onDark />
      </div>
      <nav className="fs-sidebar__groups">
        {groups.map((group) => (
          <div key={group.title} className="fs-sidebar__group">
            <div className="fs-sidebar__group-head">{group.title}</div>
            {group.items.map(({ to, label, icon: Icon, badge, comingSoon }) =>
              comingSoon ? (
                <span
                  key={to}
                  className="fs-sidebar__item fs-sidebar__item--soon"
                  aria-disabled="true"
                >
                  <Icon size={20} aria-hidden="true" />
                  <span className="fs-sidebar__label">{label}</span>
                  <span className="fs-sidebar__soon">{comingSoonLabel}</span>
                </span>
              ) : (
                <NavLink
                  key={to}
                  to={to}
                  end
                  className={({ isActive }) =>
                    ['fs-sidebar__item', isActive && 'fs-sidebar__item--active']
                      .filter(Boolean)
                      .join(' ')
                  }
                >
                  <Icon size={20} aria-hidden="true" />
                  <span className="fs-sidebar__label">{label}</span>
                  {badge ? <span className="fs-sidebar__badge">{badge}</span> : null}
                </NavLink>
              ),
            )}
          </div>
        ))}
      </nav>
      <div className="fs-sidebar__user">
        <span className="fs-sidebar__avatar">{user.initials}</span>
        <span className="fs-sidebar__meta">
          <span className="fs-sidebar__name">{user.name}</span>
          <span className="fs-sidebar__role">{user.roleLabel}</span>
        </span>
        <button
          type="button"
          className="fs-sidebar__logout"
          aria-label={logoutLabel}
          onClick={onLogout}
        >
          <Logout size={18} aria-hidden="true" />
        </button>
      </div>
    </aside>
  )
}
