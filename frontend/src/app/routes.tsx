import type { RouteObject } from 'react-router-dom'
import { AdminLayout } from './layouts/AdminLayout'
import { CustomerLayout } from './layouts/CustomerLayout'
import { DesignSystemPreview } from './pages/DesignSystemPreview'
import { NotFound } from './pages/NotFound'
import { ScreenPlaceholder } from './pages/ScreenPlaceholder'
import { RequireRole } from './RequireRole'

const screen = (titleKey: string) => <ScreenPlaceholder titleKey={titleKey} />

/** Screen → route map from CLAUDE.md. Real screens replace the placeholders in Phases 3 and 6. */
export const routes: RouteObject[] = [
  {
    element: <CustomerLayout />,
    children: [
      { path: '/', element: screen('pages.landing') },
      { path: '/menu', element: screen('pages.menu') },
      { path: '/menu/:productId', element: screen('pages.product') }, // modal over the menu
      { path: '/cart', element: screen('pages.cart') },
      { path: '/login', element: screen('pages.login') },
      { path: '/signup', element: screen('pages.signup') },
      {
        element: <RequireRole roles={['customer']} />,
        children: [
          { path: '/checkout', element: screen('pages.checkout') },
          { path: '/orders/:id', element: screen('pages.tracking') },
          { path: '/account/orders', element: screen('pages.myOrders') },
        ],
      },
      // Visual QA page for the design system, development builds only.
      ...(import.meta.env.DEV
        ? [{ path: '/_design-system', element: <DesignSystemPreview /> }]
        : []),
    ],
  },
  {
    element: <AdminLayout />,
    children: [
      {
        element: <RequireRole roles={['staff', 'admin']} />,
        children: [{ path: '/kitchen', element: screen('pages.kitchen') }],
      },
      {
        element: <RequireRole roles={['admin']} />,
        children: [
          { path: '/admin', element: screen('pages.adminDashboard') },
          { path: '/admin/products', element: screen('pages.adminProducts') },
          { path: '/admin/products/:id', element: screen('pages.productEditor') }, // "new" creates
          { path: '/admin/orders', element: screen('pages.adminOrders') },
        ],
      },
    ],
  },
  { path: '*', element: <NotFound /> },
]
