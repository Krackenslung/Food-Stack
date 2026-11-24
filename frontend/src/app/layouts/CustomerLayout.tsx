import { useTranslation } from 'react-i18next'
import { Outlet, useNavigate } from 'react-router-dom'
import { CustomerNav } from '../../design-system'
import { initialsOf } from '../../lib/auth'
import { useMediaQuery } from '../../lib/useMediaQuery'
import { AppearanceControls } from '../components/AppearanceControls'
import { selectCartCount, useCartStore } from '../../features/cart/cartStore'
import { useAuth } from '../providers/AuthProvider'
import './CustomerLayout.css'
import { MobileTabLayout } from './MobileTabLayout'

/** Customer shell: top nav on desktop, bottom tab bar below 768px. */
export function CustomerLayout() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const isMobile = useMediaQuery('(max-width: 767px)')
  const navigate = useNavigate()
  const cartCount = useCartStore(selectCartCount)

  if (isMobile) return <MobileTabLayout />

  return (
    <>
      <CustomerNav
        links={[
          { to: '/menu', label: t('nav.menu') },
          // Deals and Locations have no backend yet (see Scope): hidden until they do.
          { to: '/account/orders', label: t('nav.trackOrder') },
        ]}
        searchPlaceholder={t('nav.search')}
        cartLabel={t('nav.cart')}
        cartCount={cartCount}
        onSearch={(query) =>
          navigate(query.trim() ? `/menu?q=${encodeURIComponent(query.trim())}` : '/menu')
        }
        cartTo="/cart"
        accountTo={user ? '/account/orders' : '/login'}
        accountLabel={user ? t('nav.account') : t('nav.login')}
        initials={user ? initialsOf(user) : '?'}
        actions={<AppearanceControls />}
      />
      <main className="fs-customer-main">
        <Outlet />
      </main>
    </>
  )
}
