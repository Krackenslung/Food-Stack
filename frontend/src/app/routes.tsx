import type { RouteObject } from 'react-router-dom'
import { CartPage } from '../features/cart/CartPage'
import { CheckoutPage } from '../features/checkout/CheckoutPage'
import { LandingPage } from '../features/landing/LandingPage'
import { LoginPage } from '../features/auth/LoginPage'
import { MenuPage } from '../features/menu/MenuPage'
import { ProductModal } from '../features/menu/ProductModal'
import { MyOrdersPage } from '../features/orders/MyOrdersPage'
import { OrderTrackingPage } from '../features/orders/OrderTrackingPage'
import { SignupPage } from '../features/auth/SignupPage'
import { AdminOrdersPage } from '../features/admin/AdminOrdersPage'
import { DashboardPage } from '../features/admin/DashboardPage'
import { ProductEditorPage } from '../features/admin/ProductEditorPage'
import { ProductsPage } from '../features/admin/ProductsPage'
import { KitchenPage } from '../features/kitchen/KitchenPage'
import { AdminLayout } from './layouts/AdminLayout'
import { CustomerLayout } from './layouts/CustomerLayout'
import { DesignSystemPreview } from './pages/DesignSystemPreview'
import { NotFound } from './pages/NotFound'
import { RequireRole } from './RequireRole'

/** Screen -> route map from CLAUDE.md. Customer screens are real (Phase 3); staff/admin are Phase 6. */
export const routes: RouteObject[] = [
  {
    element: <CustomerLayout />,
    children: [
      { path: '/', element: <LandingPage /> },
      {
        path: '/menu',
        element: <MenuPage />,
        // /menu/:productId renders the customization modal over the menu.
        children: [{ path: ':productId', element: <ProductModal /> }],
      },
      { path: '/cart', element: <CartPage /> },
      {
        element: <RequireRole roles={['customer']} />,
        children: [
          { path: '/orders/:id', element: <OrderTrackingPage /> },
          { path: '/account/orders', element: <MyOrdersPage /> },
        ],
      },
      // Visual QA page for the design system, development builds only.
      ...(import.meta.env.DEV
        ? [{ path: '/_design-system', element: <DesignSystemPreview /> }]
        : []),
    ],
  },
  // Full-screen flows with their own chrome.
  { path: '/login', element: <LoginPage /> },
  { path: '/signup', element: <SignupPage /> },
  {
    element: <RequireRole roles={['customer']} />,
    children: [{ path: '/checkout', element: <CheckoutPage /> }],
  },
  {
    element: <AdminLayout />,
    children: [
      {
        element: <RequireRole roles={['staff', 'admin']} />,
        children: [{ path: '/kitchen', element: <KitchenPage /> }],
      },
      {
        element: <RequireRole roles={['admin']} />,
        children: [
          { path: '/admin', element: <DashboardPage /> },
          { path: '/admin/products', element: <ProductsPage /> },
          { path: '/admin/products/:id', element: <ProductEditorPage /> }, // "new" creates
          { path: '/admin/orders', element: <AdminOrdersPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFound /> },
]
