/** Mock of the staff/admin endpoints (kitchen, orders, dashboard, products). */
import { http, HttpResponse } from 'msw'
import type {
  AdminOrderRow,
  AdminProduct,
  AdminProductInput,
  AdminProductRow,
  Dashboard,
  DashboardRange,
  KitchenStatus,
  KitchenTicket,
  OrderStatus,
} from '../lib/api/types'
import { normalizeLanguage } from '../lib/language'
import type { Language } from '../lib/language'
import { MOCK_CATEGORIES, MOCK_INGREDIENTS } from './catalog'
import type { MockProduct } from './catalog'
import { db } from './db'
import type { MockOrder } from './db'
import {
  applyTransition,
  ensureDemoOrders,
  historyOf,
  isCard,
  MockOrderError,
  productOf,
  statusOf,
  statusSince,
  toSummary,
} from './orders'

const route = (path: string) => `*/api${path}`
const ok = (data: unknown, status = 200) => HttpResponse.json({ status: 0, data }, { status })
const fail = (message: string, errorCode: string, status: number) =>
  HttpResponse.json({ status: 1, errorMessage: message, errorCode }, { status })
const langOf = (url: URL): Language => normalizeLanguage(url.searchParams.get('lang')) ?? 'en'

function currentUser() {
  const id = db.sessionUserId()
  return db.users().find((user) => user.id === id) ?? null
}

/** Returns the signed-in user when their role is allowed, else the error response to send. */
function guard(roles: string[]) {
  const user = currentUser()
  if (!user) return { error: fail('Not authenticated', 'UNAUTHENTICATED', 401) }
  if (!roles.includes(user.role)) return { error: fail('Forbidden', 'FORBIDDEN', 403) }
  return { user }
}

const STAFF = ['staff', 'admin']
const ADMIN = ['admin']

// ---- kitchen ----------------------------------------------------------------------------------

const COLUMNS: KitchenStatus[] = ['received', 'preparing', 'ready', 'completed']
const DEMO_AVG_PREP_SECONDS = 700

function startOfToday(now = Date.now()) {
  const day = new Date(now)
  day.setHours(0, 0, 0, 0)
  return day.getTime()
}

function targetMinutes(order: MockOrder) {
  return Math.max(...order.lines.map((line) => productOf(line.productId).prepTimeMax))
}

function toTicket(order: MockOrder, lang: Language, now: number): KitchenTicket {
  const status = statusOf(order, now) as KitchenStatus
  const target = targetMinutes(order)
  const active = status === 'received' || status === 'preparing'
  return {
    id: order.id,
    orderNumber: `FS-${1000 + order.id}`,
    status,
    fulfillmentType: order.request.fulfillmentType,
    customerName: order.request.contact.name,
    createdAt: new Date(order.createdAt).toISOString(),
    statusSince: new Date(statusSince(order, now)).toISOString(),
    targetMinutes: target,
    delayed: active && now - order.createdAt > target * 60_000,
    lines: order.lines.map((line, index) => {
      const product = productOf(line.productId)
      const input = order.request.items[index]
      return {
        id: index + 1,
        productId: line.productId,
        name: product.name[lang],
        image: product.image,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        lineTotal: line.lineTotal,
        notes: input?.notes ?? '',
        ingredients: product.ingredients.map((rule) => ({
          productIngredientId: rule.id,
          name: rule.name[lang],
          default: rule.default,
          quantity:
            input?.ingredients.find((choice) => choice.productIngredientId === rule.id)?.quantity ??
            rule.default,
        })),
      }
    }),
  }
}

function avgPrepSeconds(orders: MockOrder[]): number {
  const samples: number[] = []
  for (const order of orders) {
    const history = historyOf(order)
    const received = history.find((h) => h.toStatus === 'received')
    const ready = history.find((h) => h.toStatus === 'ready')
    if (received && ready) {
      samples.push((Date.parse(ready.createdAt) - Date.parse(received.createdAt)) / 1000)
    }
  }
  if (samples.length === 0) return DEMO_AVG_PREP_SECONDS
  return Math.round(samples.reduce((a, b) => a + b, 0) / samples.length)
}

// ---- dashboard --------------------------------------------------------------------------------

// A real store would aggregate the Orders table; the demo adds today's real orders on top of a
// believable baseline so numbers move when someone orders.
const BASE_TODAY = { revenueCents: 400_000, orders: 180 }
const BASE_SOLD: Record<number, number> = { 1: 64, 2: 48, 5: 41, 14: 37, 13: 33 }
const RANGE_DAYS: Record<DashboardRange, number> = { '7d': 7, '30d': 30, '90d': 90 }

const money = (cents: number) => (cents / 100).toFixed(2)

/** Deterministic pseudo-random daily revenue (no Math.random: the chart must not jump). */
function syntheticRevenueCents(dayIndex: number) {
  const x = Math.sin(dayIndex * 12.9898) * 43758.5453
  const fraction = x - Math.floor(x)
  return Math.round(220_000 + fraction * 230_000)
}

function adminRow(order: MockOrder, lang: Language): AdminOrderRow {
  return {
    ...toSummary(order, lang),
    customerName: order.request.contact.name,
    fulfillmentType: order.request.fulfillmentType,
    paymentMethod: order.request.paymentMethod,
  }
}

function buildDashboard(range: DashboardRange, lang: Language): Dashboard {
  const orders = db.orders()
  const now = Date.now()
  const today = orders.filter(
    (order) => order.createdAt >= startOfToday(now) && statusOf(order, now) !== 'cancelled',
  )
  const todayCents = today.reduce(
    (sum, order) => sum + Math.round(Number(order.quote.total) * 100),
    0,
  )
  const revenueCents = BASE_TODAY.revenueCents + todayCents
  const orderCount = BASE_TODAY.orders + today.length

  const days = RANGE_DAYS[range]
  const series = Array.from({ length: days }, (_, index) => {
    const offset = days - 1 - index
    const date = new Date(startOfToday(now) - offset * 86_400_000)
    const cents = offset === 0 ? revenueCents : syntheticRevenueCents(date.getTime() / 86_400_000)
    return {
      date: date.toISOString().slice(0, 10),
      revenue: money(cents),
      orders: Math.round(cents / 2304),
    }
  })

  const sold = new Map<number, number>(Object.entries(BASE_SOLD).map(([id, n]) => [Number(id), n]))
  for (const order of orders) {
    if (statusOf(order, now) === 'cancelled') continue
    for (const line of order.lines)
      sold.set(line.productId, (sold.get(line.productId) ?? 0) + line.quantity)
  }
  const bestSellers = [...sold.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([productId, count]) => {
      const product = productOf(productId)
      return {
        productId,
        name: product.name[lang],
        image: product.image,
        sold: count,
        revenue: money(Math.round(Number(product.price) * 100) * count),
      }
    })

  const inKitchen = orders.filter((order) => {
    const status = statusOf(order, now)
    return status === 'received' || status === 'preparing'
  }).length

  return {
    range,
    kpis: {
      revenue: { value: money(revenueCents), deltaPct: 12.4 },
      orders: { value: String(orderCount), deltaPct: 8.1 },
      avgTicket: { value: money(Math.round(revenueCents / orderCount)), deltaPct: 3.9 },
      avgPrepSeconds: { value: avgPrepSeconds(orders), deltaSeconds: -72 },
    },
    revenueTotal: money(
      series.reduce((sum, point) => sum + Math.round(Number(point.revenue) * 100), 0),
    ),
    revenueDeltaPct: 18.2,
    series,
    bestSellers,
    recentOrders: [...orders]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 5)
      .map((order) => adminRow(order, lang)),
    ordersInKitchen: inKitchen,
  }
}

// ---- products ---------------------------------------------------------------------------------

type ProductPayload = Partial<AdminProductInput>

class ProductInvalid extends Error {
  constructor(
    message: string,
    readonly errorCode: string,
  ) {
    super(message)
  }
}

const isOrderable = (p: MockProduct) =>
  !p.deleted && p.isAvailable && p.publishStatus === 'active' && (p.stock === null || p.stock > 0)

function moneyOk(value: unknown): value is string {
  return typeof value === 'string' && /^\d+(\.\d{1,2})?$/.test(value)
}

function toAdminProduct(product: MockProduct): AdminProduct {
  const category = MOCK_CATEGORIES.find((c) => c.slug === product.category)!
  return {
    id: product.id,
    sku: product.sku,
    image: product.image,
    categoryId: category.id,
    price: product.price,
    cost: product.cost,
    stock: product.stock,
    lowStockThreshold: product.lowStockThreshold,
    prepTimeMin: product.prepTimeMin,
    prepTimeMax: product.prepTimeMax,
    calories: product.calories,
    isAvailable: product.isAvailable,
    isFeatured: product.featured,
    allowCustomization: product.allowCustomization,
    publishStatus: product.publishStatus,
    translations: {
      en: { name: product.name.en, description: product.description.en },
      es: { name: product.name.es, description: product.description.es },
    },
    ingredients: product.ingredients.map((ingredient) => ({
      id: ingredient.id,
      ingredientId: ingredient.ingredientId,
      name: ingredient.name.en,
      default: ingredient.default,
      max: ingredient.max,
      extraPrice: ingredient.extraPrice,
      removable: ingredient.removable,
    })),
  }
}

/** Server-side validation (the editor validates too, but the API never trusts it). */
function validate(input: ProductPayload) {
  const en = input.translations?.en
  if (!en?.name?.trim()) throw new ProductInvalid('Name is required.', 'PRODUCT_NAME_REQUIRED')
  if (!input.translations?.es?.name?.trim()) {
    throw new ProductInvalid('Spanish name is required.', 'PRODUCT_NAME_REQUIRED')
  }
  if (
    (en.description ?? '').length > 240 ||
    (input.translations?.es?.description ?? '').length > 240
  ) {
    throw new ProductInvalid('Description is too long.', 'DESCRIPTION_TOO_LONG')
  }
  if (!MOCK_CATEGORIES.some((c) => c.id === input.categoryId)) {
    throw new ProductInvalid('Unknown category.', 'CATEGORY_INVALID')
  }
  if (!moneyOk(input.price) || Number(input.price) <= 0) {
    throw new ProductInvalid('Price must be a positive amount.', 'PRICE_INVALID')
  }
  if (!moneyOk(input.cost)) throw new ProductInvalid('Cost must be an amount.', 'COST_INVALID')
  if (input.stock !== null && (!Number.isInteger(input.stock) || (input.stock as number) < 0)) {
    throw new ProductInvalid('Stock must be a whole number.', 'STOCK_INVALID')
  }
  const { prepTimeMin: min, prepTimeMax: max } = input
  if (
    !Number.isInteger(min) ||
    !Number.isInteger(max) ||
    (min as number) < 0 ||
    (min as number) > (max as number)
  ) {
    throw new ProductInvalid('Prep time range is invalid.', 'PREP_TIME_INVALID')
  }
  for (const row of input.ingredients ?? []) {
    if (!MOCK_INGREDIENTS.some((i) => i.id === row.ingredientId)) {
      throw new ProductInvalid('Unknown ingredient.', 'INGREDIENT_NOT_FOUND')
    }
    if (row.default < 0 || row.max < 1 || row.default > row.max || !moneyOk(row.extraPrice)) {
      throw new ProductInvalid('Ingredient limits are invalid.', 'INGREDIENT_RULE_INVALID')
    }
  }
}

function applyInput(target: MockProduct, input: AdminProductInput) {
  const category = MOCK_CATEGORIES.find((c) => c.id === input.categoryId)!
  target.category = category.slug
  target.price = Number(input.price).toFixed(2)
  target.cost = Number(input.cost).toFixed(2)
  target.stock = input.stock
  target.lowStockThreshold = input.lowStockThreshold
  target.prepTimeMin = input.prepTimeMin
  target.prepTimeMax = input.prepTimeMax
  target.calories = input.calories ?? 0
  target.isAvailable = input.isAvailable
  target.featured = input.isFeatured
  target.allowCustomization = input.allowCustomization
  target.publishStatus = input.publishStatus
  target.name = { en: input.translations.en.name.trim(), es: input.translations.es.name.trim() }
  target.description = {
    en: input.translations.en.description.trim(),
    es: input.translations.es.description.trim(),
  }

  let nextId = Math.max(target.id * 100, ...target.ingredients.map((i) => i.id)) + 1
  const existing = new Map(target.ingredients.map((i) => [i.id, i]))
  target.ingredients = input.ingredients.map((row) => {
    const catalog = MOCK_INGREDIENTS.find((i) => i.id === row.ingredientId)!
    const id = row.id !== undefined && existing.has(row.id) ? row.id : nextId++
    return {
      id,
      ingredientId: row.ingredientId,
      name: catalog.name,
      extraPrice: Number(row.extraPrice).toFixed(2),
      default: row.default,
      max: row.max,
      removable: row.removable,
    }
  })
}

function productFailure(error: unknown) {
  if (error instanceof ProductInvalid) return fail(error.message, error.errorCode, 422)
  throw error
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024

function toDataUrl(bytes: ArrayBuffer, type: string): string {
  let binary = ''
  const view = new Uint8Array(bytes)
  for (let i = 0; i < view.length; i += 0x8000) {
    binary += String.fromCharCode(...view.subarray(i, i + 0x8000))
  }
  return `data:${type};base64,${btoa(binary)}`
}

// ---- handlers ---------------------------------------------------------------------------------

export const adminHandlers = [
  http.get(route('/kitchen/orders'), ({ request }) => {
    const access = guard(STAFF)
    if (access.error) return access.error
    ensureDemoOrders()
    const lang = langOf(new URL(request.url))
    const now = Date.now()

    const columns: Record<KitchenStatus, KitchenTicket[]> = {
      received: [],
      preparing: [],
      ready: [],
      completed: [],
    }
    const orders = db.orders().sort((a, b) => a.createdAt - b.createdAt)
    for (const order of orders) {
      const status = statusOf(order, now)
      if (!COLUMNS.includes(status as KitchenStatus)) continue // cancelled / awaiting payment
      if (status === 'completed' && statusSince(order, now) < startOfToday(now)) continue
      columns[status as KitchenStatus].push(toTicket(order, lang, now))
    }
    columns.completed = columns.completed.slice(-6)

    const live = orders.filter((order) =>
      ['received', 'preparing', 'ready'].includes(statusOf(order, now)),
    )
    return ok({
      columns,
      stats: {
        active: live.length,
        avgPrepSeconds: avgPrepSeconds(orders),
        delayed: [...columns.received, ...columns.preparing].filter((t) => t.delayed).length,
      },
    })
  }),

  http.patch(route('/orders/:id/status'), async ({ params, request }) => {
    const access = guard(STAFF)
    if (access.error) return access.error
    const orders = db.orders()
    const order = orders.find((o) => o.id === Number(params.id))
    if (!order) return fail('Order not found.', 'RECORD_NOT_FOUND', 404)

    const { status } = (await request.json()) as { status: OrderStatus }
    try {
      applyTransition(order, status, access.user.role)
    } catch (error) {
      if (error instanceof MockOrderError)
        return fail(error.message, error.errorCode, error.httpStatus)
      throw error
    }
    db.saveOrders(orders)
    return ok({ status: order.status })
  }),

  http.post(route('/orders/:id/refund'), async ({ params, request }) => {
    const access = guard(ADMIN)
    if (access.error) return access.error
    const orders = db.orders()
    const order = orders.find((o) => o.id === Number(params.id))
    if (!order) return fail('Order not found.', 'RECORD_NOT_FOUND', 404)
    if (!isCard(order) || order.paidAt === null || order.refunded) {
      return fail('This order has nothing to refund.', 'ORDER_NOT_REFUNDABLE', 409)
    }
    const body = (await request.json().catch(() => ({}))) as { amount?: string }
    if (body.amount !== undefined && Number(body.amount) !== Number(order.quote.total)) {
      return fail('The demo only supports full refunds.', 'REFUND_AMOUNT_INVALID', 422)
    }

    const status = statusOf(order)
    let cancelled = false
    if (status === 'received' || status === 'pending_payment') {
      applyTransition(order, 'cancelled', 'system')
      cancelled = true
    } else {
      order.refunded = true
    }
    db.saveOrders(orders)
    return ok({
      refundId: `re_mock_${order.id}`,
      amount: order.quote.total,
      full: true,
      cancelled,
    })
  }),

  http.get(route('/admin/dashboard'), ({ request }) => {
    const access = guard(ADMIN)
    if (access.error) return access.error
    ensureDemoOrders()
    const url = new URL(request.url)
    const requested = url.searchParams.get('range') as DashboardRange | null
    const range = requested && requested in RANGE_DAYS ? requested : '7d'
    return ok(buildDashboard(range, langOf(url)))
  }),

  http.get(route('/admin/orders'), ({ request }) => {
    const access = guard(ADMIN)
    if (access.error) return access.error
    ensureDemoOrders()
    const url = new URL(request.url)
    const lang = langOf(url)
    const status = url.searchParams.get('status')
    const page = Math.max(1, Number(url.searchParams.get('page') ?? 1))
    const pageSize = Math.max(1, Number(url.searchParams.get('pageSize') ?? 10))

    const all = [...db.orders()].sort((a, b) => b.createdAt - a.createdAt)
    const counts: Record<string, number> = {
      all: all.length,
      pending_payment: 0,
      received: 0,
      preparing: 0,
      ready: 0,
      completed: 0,
      cancelled: 0,
    }
    for (const order of all) counts[statusOf(order)] += 1

    const filtered = status ? all.filter((order) => statusOf(order) === status) : all
    return ok({
      items: filtered.slice((page - 1) * pageSize, page * pageSize).map((o) => adminRow(o, lang)),
      page,
      pageSize,
      total: filtered.length,
      counts,
    })
  }),

  // ---- ingredients & products ----
  http.get(route('/admin/ingredients'), ({ request }) => {
    const access = guard(ADMIN)
    if (access.error) return access.error
    const lang = langOf(new URL(request.url))
    return ok(MOCK_INGREDIENTS.map((i) => ({ id: i.id, name: i.name[lang] })))
  }),

  http.get(route('/admin/products'), ({ request }) => {
    const access = guard(ADMIN)
    if (access.error) return access.error
    const url = new URL(request.url)
    const lang = langOf(url)
    const category = url.searchParams.get('category')
    const q = (url.searchParams.get('q') ?? '').trim().toLowerCase()
    const page = Math.max(1, Number(url.searchParams.get('page') ?? 1))
    const pageSize = Math.max(1, Number(url.searchParams.get('pageSize') ?? 10))

    const live = db.products().filter((p) => !p.deleted)
    const categoryCounts: Record<string, number> = { all: live.length }
    for (const c of MOCK_CATEGORIES) {
      categoryCounts[c.slug] = live.filter((p) => p.category === c.slug).length
    }

    const rows = live
      .filter((p) => !category || p.category === category)
      .filter(
        (p) =>
          !q ||
          p.name.en.toLowerCase().includes(q) ||
          p.name.es.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q),
      )

    const toRow = (p: MockProduct): AdminProductRow => {
      const cat = MOCK_CATEGORIES.find((c) => c.slug === p.category)!
      return {
        id: p.id,
        sku: p.sku,
        name: p.name[lang],
        image: p.image,
        category: { id: cat.id, slug: cat.slug, name: cat.name[lang] },
        price: p.price,
        stock: p.stock,
        lowStockThreshold: p.lowStockThreshold,
        publishStatus: p.publishStatus,
        isAvailable: p.isAvailable,
        ingredientCount: p.ingredients.length,
      }
    }

    return ok({
      items: rows.slice((page - 1) * pageSize, page * pageSize).map(toRow),
      page,
      pageSize,
      total: rows.length,
      categoryCounts,
      stats: {
        active: live.filter(isOrderable).length,
        lowStock: live.filter(
          (p) =>
            p.publishStatus === 'active' &&
            p.stock !== null &&
            p.stock > 0 &&
            p.stock < p.lowStockThreshold,
        ).length,
        outOfStock: live.filter((p) => p.publishStatus === 'active' && p.stock === 0).length,
        drafts: live.filter((p) => p.publishStatus === 'draft').length,
      },
    })
  }),

  http.get(route('/admin/products/:id'), ({ params }) => {
    const access = guard(ADMIN)
    if (access.error) return access.error
    const product = db.products().find((p) => p.id === Number(params.id) && !p.deleted)
    if (!product) return fail('Product not found.', 'RECORD_NOT_FOUND', 404)
    return ok(toAdminProduct(product))
  }),

  http.post(route('/admin/products'), async ({ request }) => {
    const access = guard(ADMIN)
    if (access.error) return access.error
    const input = (await request.json()) as AdminProductInput
    try {
      validate(input)
    } catch (error) {
      return productFailure(error)
    }

    const products = db.products()
    const category = MOCK_CATEGORIES.find((c) => c.id === input.categoryId)!
    const letter = { burgers: 'B', burritos: 'R', sides: 'S', beverages: 'D' }[category.slug]
    const sameCategory = products.filter((p) => p.category === category.slug).length
    const created: MockProduct = {
      id: Math.max(0, ...products.map((p) => p.id)) + 1,
      category: category.slug,
      price: '0.00',
      calories: 0,
      prepTimeMin: 0,
      prepTimeMax: 0,
      image: '/menu/overkill-double.jpg',
      featured: false,
      name: { en: '', es: '' },
      description: { en: '', es: '' },
      allowCustomization: true,
      ingredients: [],
      sku: `SKU-${letter}${String(sameCategory + 1).padStart(3, '0')}`,
      cost: '0.00',
      stock: null,
      lowStockThreshold: 10,
      publishStatus: 'draft',
      isAvailable: false,
      deleted: false,
    }
    applyInput(created, input)
    db.saveProducts([...products, created])
    return ok(toAdminProduct(created), 201)
  }),

  http.put(route('/admin/products/:id'), async ({ params, request }) => {
    const access = guard(ADMIN)
    if (access.error) return access.error
    const products = db.products()
    const product = products.find((p) => p.id === Number(params.id) && !p.deleted)
    if (!product) return fail('Product not found.', 'RECORD_NOT_FOUND', 404)

    const input = (await request.json()) as AdminProductInput
    try {
      validate(input)
    } catch (error) {
      return productFailure(error)
    }
    applyInput(product, input)
    db.saveProducts(products)
    return ok(toAdminProduct(product))
  }),

  http.patch(route('/admin/products/:id'), async ({ params, request }) => {
    const access = guard(ADMIN)
    if (access.error) return access.error
    const products = db.products()
    const product = products.find((p) => p.id === Number(params.id) && !p.deleted)
    if (!product) return fail('Product not found.', 'RECORD_NOT_FOUND', 404)
    const { isAvailable } = (await request.json()) as { isAvailable: boolean }
    product.isAvailable = Boolean(isAvailable)
    db.saveProducts(products)
    return ok({ isAvailable: product.isAvailable })
  }),

  http.delete(route('/admin/products/:id'), ({ params }) => {
    const access = guard(ADMIN)
    if (access.error) return access.error
    const products = db.products()
    const product = products.find((p) => p.id === Number(params.id) && !p.deleted)
    if (!product) return fail('Product not found.', 'RECORD_NOT_FOUND', 404)
    product.deleted = true // soft delete: past orders keep referencing the row
    db.saveProducts(products)
    return ok({ deleted: true })
  }),

  http.post(route('/admin/products/:id/image'), async ({ params, request }) => {
    const access = guard(ADMIN)
    if (access.error) return access.error
    const products = db.products()
    const product = products.find((p) => p.id === Number(params.id) && !p.deleted)
    if (!product) return fail('Product not found.', 'RECORD_NOT_FOUND', 404)

    const file = (await request.formData()).get('image')
    if (!(file instanceof Blob)) return fail('An image file is required.', 'IMAGE_REQUIRED', 422)
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      return fail('Use a PNG or JPG image.', 'IMAGE_TYPE_INVALID', 422)
    }
    if (file.size > MAX_IMAGE_BYTES) return fail('The image is too large.', 'IMAGE_TOO_LARGE', 422)

    product.image = toDataUrl(await file.arrayBuffer(), file.type)
    db.saveProducts(products)
    return ok({ imageUrl: product.image })
  }),
]
