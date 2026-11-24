import { useTranslation } from 'react-i18next'
import { Outlet } from 'react-router-dom'
import { Grid, Home, Receipt, TabBar, User } from '../../design-system'
import { AppearanceControls } from '../components/AppearanceControls'
import { useAuth } from '../providers/AuthProvider'
import './MobileTabLayout.css'

export function MobileTabLayout() {
  const { t } = useTranslation()
  const { user } = useAuth()

  return (
    <div className="fs-mobile-shell">
      <main className="fs-mobile-shell__content">
        <Outlet />
        <div className="fs-mobile-shell__settings">
          <AppearanceControls />
        </div>
      </main>
      <TabBar
        ariaLabel={t('tabs.label')}
        items={[
          { to: '/', label: t('tabs.home'), icon: Home },
          { to: '/menu', label: t('tabs.menu'), icon: Grid },
          { to: '/account/orders', label: t('tabs.orders'), icon: Receipt },
          { to: user ? '/account/orders' : '/login', label: t('tabs.profile'), icon: User },
        ]}
      />
    </div>
  )
}
