/**
 * DTOs for the target API contract (CLAUDE.md "API contract"). Money is always a decimal
 * string ("12.99") so no floating point ever touches an amount; convert with Number() only
 * to format for display.
 *
 * Fields marked (proposed) extend the written contract and need backend support.
 */

export type FulfillmentType = 'pickup' | 'delivery'
export type PaymentMethod = 'card' | 'counter'

export type OrderStatus =
  'pending_payment' | 'received' | 'preparing' | 'ready' | 'completed' | 'cancelled'

export type PaymentStatus = 'unpaid' | 'paid' | 'failed' | 'refunded' | 'pay_at_counter'

export type Category = { id: number; slug: string; name: string }

export type MenuProduct = {
  id: number
  name: string
  description: string
  image: string
  price: string
  calories: number | null
  prepTimeMin: number | null
  prepTimeMax: number | null
  isAvailable: boolean
  /** null = stock is not tracked. */
  stock: number | null
  /** (proposed) mirrors Products.Is_Featured; drives "Popular this week". */
  isFeatured: boolean
}

export type MenuSection = { category: Category; products: MenuProduct[] }

export type ProductIngredient = {
  productIngredientId: number
  name: string
  extraPrice: string
  default: number
  max: number
  removable: boolean
}

export type ProductDetail = MenuProduct & {
  category: Category
  allowCustomization: boolean
  ingredients: ProductIngredient[]
}

/** (proposed) GET /store: public store info, hours and fees. */
export type StoreInfo = {
  name: string
  address: string
  timezone: string
  currency: string
  isOpen: boolean
  /** (proposed) true when the backend has Stripe keys configured. */
  paymentsEnabled: boolean
  /** "HH:MM" local time; used for "Closed · opens at 11:00" and "Open until 11:00 PM". */
  opensAt: string
  closesAt: string
  waitMinutes: number
}

export type CartLineInput = {
  productId: number
  quantity: number
  ingredients: { productIngredientId: number; quantity: number }[]
  notes?: string
}

export type QuoteRequest = {
  items: CartLineInput[]
  promoCode?: string
  fulfillmentType: FulfillmentType
}

export type QuoteLine = {
  productId: number
  quantity: number
  unitPrice: string
  extras: string
  lineTotal: string
}

export type PromoResult = { code: string; valid: boolean; reason: string | null }

export type Quote = {
  lines: QuoteLine[]
  subtotal: string
  discount: string
  serviceFee: string
  deliveryFee: string
  tax: string
  total: string
  promo: PromoResult | null
}

export type CheckoutRequest = QuoteRequest & {
  contact: { name: string; phone: string; email: string }
  deliveryAddress?: string
  /** ISO string; omitted = ASAP. */
  scheduledFor?: string
  paymentMethod: PaymentMethod
}

export type CheckoutResult = {
  orderId: number
  orderNumber: string
  total: string
  clientSecret?: string
}

export type OrderLineIngredient = {
  productIngredientId: number
  name: string
  quantity: number
  default: number
}

export type OrderLine = {
  id: number
  productId: number
  name: string
  image: string
  quantity: number
  unitPrice: string
  lineTotal: string
  ingredients: OrderLineIngredient[]
  notes: string
}

export type OrderHistoryEntry = {
  fromStatus: OrderStatus | null
  toStatus: OrderStatus
  createdAt: string
}

export type OrderSummary = {
  id: number
  orderNumber: string
  status: OrderStatus
  paymentStatus: PaymentStatus
  total: string
  createdAt: string
  itemCount: number
  /** First line names/images for the list row. */
  items: { name: string; image: string; quantity: number }[]
}

export type OrderDetail = Omit<OrderSummary, 'items'> & {
  paymentMethod: PaymentMethod
  fulfillmentType: FulfillmentType
  subtotal: string
  discount: string
  serviceFee: string
  deliveryFee: string
  tax: string
  promoCode: string | null
  contact: { name: string; phone: string; email: string }
  deliveryAddress: string | null
  scheduledFor: string | null
  lines: OrderLine[]
  history: OrderHistoryEntry[]
  eta: { minutes: number; readyAt: string } | null
}

export type Paged<T> = { items: T[]; page: number; pageSize: number; total: number }

export type AuthRequest = { email: string; password: string }
export type SignupRequest = AuthRequest & {
  name: string
  lastname: string
  phoneNumber: string
}

// ---- staff & admin ---------------------------------------------------------------------------

export type KitchenStatus = 'received' | 'preparing' | 'ready' | 'completed'

export type KitchenTicket = {
  id: number
  orderNumber: string
  status: KitchenStatus
  fulfillmentType: FulfillmentType
  customerName: string
  createdAt: string
  /** When the order entered its current column (drives the ticket timer). */
  statusSince: string
  /** Target time from order to ready (max Prep_Time_Max of its items). */
  targetMinutes: number
  delayed: boolean
  lines: OrderLine[]
}

export type KitchenBoard = {
  columns: Record<KitchenStatus, KitchenTicket[]>
  stats: { active: number; avgPrepSeconds: number; delayed: number }
}

export type AdminOrderRow = OrderSummary & {
  customerName: string
  fulfillmentType: FulfillmentType
  paymentMethod: PaymentMethod
}

export type AdminOrdersPage = Paged<AdminOrderRow> & {
  counts: Record<'all' | OrderStatus, number>
}

export type DashboardRange = '7d' | '30d' | '90d'

export type Kpi = { value: string; deltaPct: number }

export type Dashboard = {
  range: DashboardRange
  kpis: {
    revenue: Kpi
    orders: Kpi
    avgTicket: Kpi
    avgPrepSeconds: { value: number; deltaSeconds: number }
  }
  revenueTotal: string
  revenueDeltaPct: number
  series: { date: string; revenue: string; orders: number }[]
  bestSellers: { productId: number; name: string; image: string; sold: number; revenue: string }[]
  recentOrders: AdminOrderRow[]
  ordersInKitchen: number
}

export type AdminProductRow = {
  id: number
  sku: string
  name: string
  image: string
  category: Category
  price: string
  stock: number | null
  lowStockThreshold: number
  publishStatus: 'active' | 'draft'
  isAvailable: boolean
  ingredientCount: number
}

export type AdminProductsPage = Paged<AdminProductRow> & {
  stats: { active: number; lowStock: number; outOfStock: number; drafts: number }
  categoryCounts: Record<string, number>
}

export type AdminProductIngredient = {
  /** Product_Ingredients.Id; absent for rows added in the editor. */
  id?: number
  ingredientId: number
  name: string
  default: number
  max: number
  extraPrice: string
  removable: boolean
}

export type ProductTranslations = Record<'en' | 'es', { name: string; description: string }>

export type AdminProductInput = {
  categoryId: number
  price: string
  cost: string
  /** null = stock is not tracked. */
  stock: number | null
  lowStockThreshold: number
  prepTimeMin: number
  prepTimeMax: number
  calories: number | null
  isAvailable: boolean
  isFeatured: boolean
  allowCustomization: boolean
  publishStatus: 'active' | 'draft'
  translations: ProductTranslations
  ingredients: AdminProductIngredient[]
}

export type AdminProduct = AdminProductInput & { id: number; sku: string; image: string }

export type AdminIngredient = { id: number; name: string }
