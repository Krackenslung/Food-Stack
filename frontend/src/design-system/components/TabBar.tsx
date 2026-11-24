import { NavLink } from 'react-router-dom'
import type { LucideIcon } from '../icons'
import './TabBar.css'

export type TabBarItem = { to: string; label: string; icon: LucideIcon }

type TabBarProps = { items: TabBarItem[]; ariaLabel: string }

/** Mobile bottom tab bar (Figma M1/M3 "tab-bar"). */
export function TabBar({ items, ariaLabel }: TabBarProps) {
  return (
    <nav className="fs-tabbar" aria-label={ariaLabel}>
      {items.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            ['fs-tabbar__tab', isActive && 'fs-tabbar__tab--active'].filter(Boolean).join(' ')
          }
        >
          <Icon size={22} aria-hidden="true" />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
