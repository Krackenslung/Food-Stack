import { useTranslation } from 'react-i18next'
import { Outlet, useNavigate } from 'react-router-dom'
import {
  AdminSidebar,
  Chart,
  Grid,
  Package,
  Receipt,
  Sliders,
  Users,
  Utensils,
  Zap,
} from '../../design-system'
import type { AdminSidebarGroup } from '../../design-system'
import { initialsOf } from '../../lib/auth'
import type { Role } from '../../lib/auth'
import { AppearanceControls } from '../components/AppearanceControls'
import { useAuth } from '../providers/AuthProvider'
import './AdminLayout.css'

/** Sidebar structure from Figma A1; Categories/Ingredients/Customers/Reports are UI-only for now. */
function buildGroups(role: Role, t: (key: string) => string): AdminSidebarGroup[] {
  const kitchen = { to: '/kitchen', label: t('admin.items.kitchen'), icon: Utensils }

  // Staff only work the kitchen board.
  if (role === 'staff') {
    return [{ title: t('admin.groups.overview'), items: [kitchen] }]
  }

  return [
    {
      title: t('admin.groups.overview'),
      items: [
        { to: '/admin', label: t('admin.items.dashboard'), icon: Grid },
        { to: '/admin/orders', label: t('admin.items.orders'), icon: Receipt },
        kitchen,
      ],
    },
    {
      title: t('admin.groups.catalog'),
      items: [
        { to: '/admin/products', label: t('admin.items.products'), icon: Package },
        {
          to: '/admin/categories',
          label: t('admin.items.categories'),
          icon: Sliders,
          comingSoon: true,
        },
        {
          to: '/admin/ingredients',
          label: t('admin.items.ingredients'),
          icon: Zap,
          comingSoon: true,
        },
      ],
    },
    {
      title: t('admin.groups.business'),
      items: [
        {
          to: '/admin/customers',
          label: t('admin.items.customers'),
          icon: Users,
          comingSoon: true,
        },
        { to: '/admin/reports', label: t('admin.items.reports'), icon: Chart, comingSoon: true },
      ],
    },
  ]
}

export function AdminLayout() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const role: Role = user?.role ?? 'staff'

  return (
    <div className="fs-admin-shell">
      <AdminSidebar
        groups={buildGroups(role, t)}
        comingSoonLabel={t('common.comingSoon')}
        user={{
          initials: initialsOf(user),
          name: user ? `${user.name} ${user.lastname}`.trim() : '',
          roleLabel: t(role === 'admin' ? 'admin.roles.admin' : 'admin.roles.staff'),
        }}
        logoutLabel={t('admin.logout')}
        onLogout={() => {
          void logout().then(() => navigate('/login'))
        }}
      />
      <div className="fs-admin-shell__main">
        <div className="fs-admin-shell__topbar">
          <AppearanceControls />
        </div>
        <main className="fs-admin-shell__content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
