import { request } from '../api-client'
import type { Language } from '../language'
import type {
  AdminIngredient,
  AdminOrdersPage,
  AdminProduct,
  AdminProductInput,
  AdminProductsPage,
  AuthRequest,
  CheckoutRequest,
  CheckoutResult,
  Dashboard,
  DashboardRange,
  KitchenBoard,
  MenuSection,
  OrderDetail,
  OrderStatus,
  OrderSummary,
  Paged,
  ProductDetail,
  Quote,
  QuoteRequest,
  SignupRequest,
  StoreInfo,
} from './types'

/** Thin typed wrappers over the contract. All paths are relative to the API base URL. */
export const api = {
  store: () => request<StoreInfo>('/store', { auth: false }),

  menu: (lang: Language) => request<MenuSection[]>(`/menu?lang=${lang}`, { auth: false }),

  product: (id: number, lang: Language) =>
    request<ProductDetail>(`/products/${id}?lang=${lang}`, { auth: false }),

  quote: (body: QuoteRequest) =>
    request<Quote>('/cart/quote', { method: 'POST', body, auth: false }),

  checkout: (body: CheckoutRequest) =>
    request<CheckoutResult>('/checkout', { method: 'POST', body }),

  myOrders: (params: { status?: string; page?: number; pageSize?: number }, lang: Language) => {
    const query = new URLSearchParams({ lang })
    if (params.status) query.set('status', params.status)
    query.set('page', String(params.page ?? 1))
    query.set('pageSize', String(params.pageSize ?? 5))
    return request<Paged<OrderSummary>>(`/me/orders?${query}`)
  },

  order: (id: number, lang: Language) => request<OrderDetail>(`/orders/${id}?lang=${lang}`),

  cancelOrder: (id: number, reason?: string) =>
    request<{ status: OrderStatus }>(`/orders/${id}/cancel`, { method: 'POST', body: { reason } }),

  login: (body: AuthRequest) =>
    request<unknown>('/auth/login', { method: 'POST', body, auth: false }),

  signup: (body: SignupRequest) =>
    request<unknown>('/auth/signup', { method: 'POST', body, auth: false }),

  googleLogin: (idToken: string) =>
    request<unknown>('/auth/google', { method: 'POST', body: { idToken }, auth: false }),

  // ---- staff & admin ----
  kitchen: () => request<KitchenBoard>('/kitchen/orders'),

  setOrderStatus: (id: number, status: OrderStatus) =>
    request<{ status: OrderStatus }>(`/orders/${id}/status`, { method: 'PATCH', body: { status } }),

  refundOrder: (id: number, amount?: string) =>
    request<{ refundId: string; amount: string; full: boolean; cancelled: boolean }>(
      `/orders/${id}/refund`,
      { method: 'POST', body: amount ? { amount } : {} },
    ),

  dashboard: (range: DashboardRange) => request<Dashboard>(`/admin/dashboard?range=${range}`),

  adminOrders: (params: { status?: string; page?: number; pageSize?: number }, lang: Language) => {
    const query = new URLSearchParams({ lang, page: String(params.page ?? 1) })
    query.set('pageSize', String(params.pageSize ?? 10))
    if (params.status && params.status !== 'all') query.set('status', params.status)
    return request<AdminOrdersPage>(`/admin/orders?${query}`)
  },

  adminProducts: (
    params: { category?: string; q?: string; page?: number; pageSize?: number },
    lang: Language,
  ) => {
    const query = new URLSearchParams({ lang, page: String(params.page ?? 1) })
    query.set('pageSize', String(params.pageSize ?? 10))
    if (params.category && params.category !== 'all') query.set('category', params.category)
    if (params.q) query.set('q', params.q)
    return request<AdminProductsPage>(`/admin/products?${query}`)
  },

  adminProduct: (id: number) => request<AdminProduct>(`/admin/products/${id}`),

  createProduct: (body: AdminProductInput) =>
    request<AdminProduct>('/admin/products', { method: 'POST', body }),

  updateProduct: (id: number, body: AdminProductInput) =>
    request<AdminProduct>(`/admin/products/${id}`, { method: 'PUT', body }),

  /** (proposed) quick toggle used by the products table. */
  setProductAvailability: (id: number, isAvailable: boolean) =>
    request<{ isAvailable: boolean }>(`/admin/products/${id}`, {
      method: 'PATCH',
      body: { isAvailable },
    }),

  /** Soft delete (Status = 0). */
  deleteProduct: (id: number) => request<unknown>(`/admin/products/${id}`, { method: 'DELETE' }),

  uploadProductImage: (id: number, file: File) => {
    const form = new FormData()
    form.append('image', file)
    return request<{ imageUrl: string }>(`/admin/products/${id}/image`, { method: 'POST', form })
  },

  adminIngredients: (lang: Language) =>
    request<AdminIngredient[]>(`/admin/ingredients?lang=${lang}`),

  logout: () => request<unknown>('/auth/logout', { method: 'POST' }),
}
