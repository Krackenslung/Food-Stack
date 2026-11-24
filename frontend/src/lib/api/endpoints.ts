import { request } from '../api-client'
import type { Language } from '../language'
import type {
  AuthRequest,
  CheckoutRequest,
  CheckoutResult,
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

  logout: () => request<unknown>('/auth/logout', { method: 'POST' }),
}
