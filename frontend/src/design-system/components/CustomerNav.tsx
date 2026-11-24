import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { Cart, Search } from '../icons'
import { Logo } from './Logo'
import './CustomerNav.css'

export type CustomerNavLink = { to: string; label: string }

type CustomerNavProps = {
  links: CustomerNavLink[]
  searchPlaceholder: string
  cartLabel: string
  cartCount: number
  cartTo: string
  /** Where the avatar goes (account / login). */
  accountTo: string
  accountLabel: string
  initials: string
  /** Extra controls rendered before the cart (theme and language toggles). */
  actions?: ReactNode
  onSearch?: (query: string) => void
}

export function CustomerNav({
  links,
  searchPlaceholder,
  cartLabel,
  cartCount,
  cartTo,
  accountTo,
  accountLabel,
  initials,
  actions,
  onSearch,
}: CustomerNavProps) {
  return (
    <header className="fs-customer-nav">
      <div className="fs-customer-nav__left">
        <Link to="/" aria-label="FoodStack">
          <Logo />
        </Link>
        <nav className="fs-customer-nav__links">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                ['fs-customer-nav__link', isActive && 'fs-customer-nav__link--active']
                  .filter(Boolean)
                  .join(' ')
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </div>
      <div className="fs-customer-nav__right">
        <form
          className="fs-customer-nav__search"
          role="search"
          onSubmit={(event) => {
            event.preventDefault()
            const query = new FormData(event.currentTarget).get('q')
            onSearch?.(String(query ?? ''))
          }}
        >
          <Search size={18} aria-hidden="true" />
          <input
            name="q"
            type="search"
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
          />
        </form>
        {actions}
        <Link to={cartTo} className="fs-customer-nav__cart">
          <Cart size={18} aria-hidden="true" />
          <span>{cartLabel}</span>
          <span className="fs-customer-nav__count" aria-hidden={cartCount === 0}>
            {cartCount}
          </span>
        </Link>
        <Link to={accountTo} className="fs-customer-nav__avatar" aria-label={accountLabel}>
          {initials}
        </Link>
      </div>
    </header>
  )
}
