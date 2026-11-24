import { http, HttpResponse } from 'msw'
import type {
  CheckoutRequest,
  MenuProduct,
  OrderDetail,
  OrderHistoryEntry,
  OrderStatus,
  OrderSummary,
  ProductDetail,
  QuoteRequest,
  SignupRequest,
  StoreInfo,
} from '../lib/api/types'
import { normalizeLanguage } from '../lib/language'
import type { Language } from '../lib/language'
import { MOCK_CATEGORIES, MOCK_PRODUCTS, productIngredientId } from './catalog'
import type { MockProduct } from './catalog'
import { db } from './db'
import type { MockOrder, MockUser } from './db'
import { parseMockCredential } from './credential'
import { MockValidationError, quoteCart } from './pricing'

// Matches both the dev proxy ("/api/...") and an absolute VITE_API_BASE_URL.
const route = (path: string) => `*/api${path}`

const ok = (data: unknown, status = 200) => HttpResponse.json({ status: 0, data }, { status })

const fail = (message: string, errorCode: string, status: number) =>
  HttpResponse.json({ status: 1, errorMessage: message, errorCode }, { status })

const langOf = (url: URL): Language => normalizeLanguage(url.searchParams.get('lang')) ?? 'en'

function currentUser(): MockUser | null {
  const id = db.sessionUserId()
  return db.users().find((user) => user.id === id) ?? null
}

// ---- store -----------------------------------------------------------------

/** Card payments in the demo. localStorage['foodstack-mock-payments'] = '0' turns them off. */
function paymentsEnabled(): boolean {
  try {
    return window.localStorage.getItem('foodstack-mock-payments') !== '0'
  } catch {
    return true
  }
}

const OPENS = 11
const CLOSES = 23

function storeInfo(): StoreInfo {
  let isOpen: boolean
  const override = (() => {
    try {
      return window.localStorage.getItem('foodstack-mock-open')
    } catch {
      return null
    }
  })()
  if (override !== 'auto') {
    // Demo default: always open, so demos work at any hour. '0' forces closed,
    // 'auto' follows the real hours (11:00-23:00 America/Tijuana).
    isOpen = override !== '0'
  } else {
    const hour = Number(
      new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        hour12: false,
        timeZone: 'America/Tijuana',
      }).format(new Date()),
    )
    isOpen = hour >= OPENS && hour < CLOSES
  }

  return {
    name: 'FoodStack Zona Río',
    address: 'Blvd. Sánchez Taboada 10488, Tijuana, B.C.',
    timezone: 'America/Tijuana',
    currency: 'USD',
    isOpen,
    paymentsEnabled: paymentsEnabled(),
    opensAt: `${OPENS}:00`,
    closesAt: `${CLOSES}:00`,
    waitMinutes: 15,
  }
}

// ---- catalog ---------------------------------------------------------------

function toMenuProduct(product: MockProduct, lang: Language): MenuProduct {
  return {
    id: product.id,
    name: product.name[lang],
    description: product.description[lang],
    image: product.image,
    price: product.price,
    calories: product.calories,
    prepTimeMin: product.prepTimeMin,
    prepTimeMax: product.prepTimeMax,
    isAvailable: true,
    stock: null,
    isFeatured: product.featured,
  }
}

function toProductDetail(product: MockProduct, lang: Language): ProductDetail {
  const category = MOCK_CATEGORIES.find((c) => c.slug === product.category)!
  return {
    ...toMenuProduct(product, lang),
    category: { id: category.id, slug: category.slug, name: category.name[lang] },
    allowCustomization: product.allowCustomization,
    ingredients: product.ingredients.map((ingredient, index) => ({
      productIngredientId: productIngredientId(product.id, index),
      name: ingredient.name[lang],
      extraPrice: ingredient.extraPrice,
      default: ingredient.default,
      max: ingredient.max,
      removable: ingredient.removable,
    })),
  }
}

// ---- orders ----------------------------------------------------------------

const RECEIVED_FOR_MS = 20_000
const PREPARING_FOR_MS = 60_000

const isCard = (order: MockOrder) => order.request.paymentMethod === 'card'

/** Demo progression: received -> preparing after 20s -> ready after 60s (counted from payment). */
function statusOf(order: MockOrder, now = Date.now()): OrderStatus {
  if (order.status === 'cancelled' || order.status === 'completed') return order.status
  if (isCard(order) && order.paidAt === null) return 'pending_payment'
  const age = now - (order.paidAt ?? order.createdAt)
  if (age < RECEIVED_FOR_MS) return 'received'
  if (age < PREPARING_FOR_MS) return 'preparing'
  return 'ready'
}

function historyOf(order: MockOrder, now = Date.now()): OrderHistoryEntry[] {
  const iso = (ms: number) => new Date(ms).toISOString()
  const entries: OrderHistoryEntry[] = []
  let from: OrderStatus | null = null
  const push = (to: OrderStatus, at: number) => {
    entries.push({ fromStatus: from, toStatus: to, createdAt: iso(at) })
    from = to
  }

  if (isCard(order)) push('pending_payment', order.createdAt)
  const receivedAt = order.paidAt ?? order.createdAt
  if (!isCard(order) || order.paidAt !== null) push('received', receivedAt)

  if (order.status === 'cancelled') {
    push('cancelled', order.cancelledAt ?? now)
    return entries
  }
  const age = now - receivedAt
  if (entries.length > 0 && from === 'received' && age >= RECEIVED_FOR_MS) {
    push('preparing', receivedAt + RECEIVED_FOR_MS)
  }
  if (from === 'preparing' && age >= PREPARING_FOR_MS) push('ready', receivedAt + PREPARING_FOR_MS)
  return entries
}

function productOf(id: number): MockProduct {
  return MOCK_PRODUCTS.find((p) => p.id === id)!
}

function baseSummary(order: MockOrder): Omit<OrderSummary, 'items'> {
  return {
    id: order.id,
    orderNumber: `FS-${1000 + order.id}`,
    status: statusOf(order),
    paymentStatus: !isCard(order)
      ? 'pay_at_counter'
      : order.refunded
        ? 'refunded'
        : order.paidAt === null
          ? 'unpaid'
          : 'paid',
    total: order.quote.total,
    createdAt: new Date(order.createdAt).toISOString(),
    itemCount: order.lines.reduce((sum, line) => sum + line.quantity, 0),
  }
}

function toSummary(order: MockOrder, lang: Language): OrderSummary {
  return {
    ...baseSummary(order),
    items: order.lines.map((line) => ({
      name: productOf(line.productId).name[lang],
      image: productOf(line.productId).image,
      quantity: line.quantity,
    })),
  }
}

function toDetail(order: MockOrder, lang: Language): OrderDetail {
  const status = statusOf(order)

  const longestPrep = Math.max(...order.lines.map((l) => productOf(l.productId).prepTimeMax))
  const readyAt = (order.paidAt ?? order.createdAt) + longestPrep * 60_000
  const active = status === 'received' || status === 'preparing'

  return {
    ...baseSummary(order),
    paymentMethod: order.request.paymentMethod,
    fulfillmentType: order.request.fulfillmentType,
    subtotal: order.quote.subtotal,
    discount: order.quote.discount,
    serviceFee: order.quote.serviceFee,
    deliveryFee: order.quote.deliveryFee,
    tax: order.quote.tax,
    promoCode: order.promoCode,
    contact: order.request.contact,
    deliveryAddress: order.request.deliveryAddress ?? null,
    scheduledFor: order.request.scheduledFor ?? null,
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
        ingredients: product.ingredients.map((rule, i) => ({
          productIngredientId: productIngredientId(product.id, i),
          name: rule.name[lang],
          default: rule.default,
          quantity:
            input?.ingredients.find(
              (choice) => choice.productIngredientId === productIngredientId(product.id, i),
            )?.quantity ?? rule.default,
        })),
      }
    }),
    history: historyOf(order),
    eta: active
      ? {
          minutes: Math.max(1, Math.ceil((readyAt - Date.now()) / 60_000)),
          readyAt: new Date(readyAt).toISOString(),
        }
      : null,
  }
}

function validationFailure(error: unknown) {
  if (error instanceof MockValidationError) return fail(error.message, error.errorCode, 422)
  throw error
}

// ---- handlers --------------------------------------------------------------

export const handlers = [
  http.get(route('/test'), () => ok({ message: 'mock api' })),

  http.get(route('/store'), () => ok(storeInfo())),

  http.get(route('/menu'), ({ request }) => {
    const lang = langOf(new URL(request.url))
    return ok(
      MOCK_CATEGORIES.map((category) => ({
        category: { id: category.id, slug: category.slug, name: category.name[lang] },
        products: MOCK_PRODUCTS.filter((p) => p.category === category.slug).map((p) =>
          toMenuProduct(p, lang),
        ),
      })),
    )
  }),

  http.get(route('/products/:id'), ({ params, request }) => {
    const product = MOCK_PRODUCTS.find((p) => p.id === Number(params.id))
    if (!product) return fail('Product not found.', 'RECORD_NOT_FOUND', 404)
    return ok(toProductDetail(product, langOf(new URL(request.url))))
  }),

  http.post(route('/cart/quote'), async ({ request }) => {
    const body = (await request.json()) as QuoteRequest
    const user = currentUser()
    const hasPriorOrder = user ? db.orders().some((o) => o.userId === user.id) : false
    try {
      return ok(quoteCart(body.items ?? [], body.fulfillmentType, body.promoCode, hasPriorOrder))
    } catch (error) {
      return validationFailure(error)
    }
  }),

  // ---- auth ----
  http.post(route('/auth/signup'), async ({ request }) => {
    const body = (await request.json()) as SignupRequest
    if (!body.email || !body.password || !body.name) {
      return fail('Missing fields.', 'VALIDATION_ERROR', 422)
    }
    const users = db.users()
    if (users.some((u) => u.email.toLowerCase() === body.email.toLowerCase())) {
      return fail('That email is already registered.', 'EMAIL_TAKEN', 409)
    }
    // Public signup always creates a customer (the server never trusts a client role).
    const user: MockUser = {
      id: Math.max(0, ...users.map((u) => u.id)) + 1,
      name: body.name,
      lastname: body.lastname,
      email: body.email,
      phoneNumber: body.phoneNumber,
      password: body.password,
      role: 'customer',
    }
    db.saveUsers([...users, user])
    db.setSession(user.id)
    return ok({ user: publicUser(user) }, 201)
  }),

  // Same rules as backend/Services/auth_service.py: verified email only, find by Google id, link
  // by email, create customers, and the role always comes from the account, never the token.
  http.post(route('/auth/google'), async ({ request }) => {
    const { idToken } = (await request.json()) as { idToken?: string }
    const claims = typeof idToken === 'string' ? parseMockCredential(idToken) : null
    if (!claims?.sub || !claims.email) {
      return fail('Invalid Google token.', 'INVALID_GOOGLE_TOKEN', 401)
    }
    if (claims.email_verified !== true) {
      return fail('Your Google email is not verified.', 'EMAIL_NOT_VERIFIED', 401)
    }

    const users = db.users()
    const email = claims.email.toLowerCase()
    let user = users.find((u) => u.googleSub === claims.sub)
    if (!user) {
      const existing = users.find((u) => u.email.toLowerCase() === email)
      if (existing) {
        if (existing.googleSub && existing.googleSub !== claims.sub) {
          return fail(
            'That email is linked to another Google account.',
            'ACCOUNT_LINKED_ELSEWHERE',
            409,
          )
        }
        existing.googleSub = claims.sub
        user = existing
      } else {
        user = {
          id: Math.max(0, ...users.map((u) => u.id)) + 1,
          name: claims.given_name || email.split('@')[0],
          lastname: claims.family_name || '',
          email,
          phoneNumber: '',
          password: '',
          role: 'customer',
          googleSub: claims.sub,
        }
        users.push(user)
      }
      db.saveUsers(users)
    }
    db.setSession(user.id)
    return ok({ user: publicUser(user) })
  }),

  http.post(route('/auth/login'), async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string }
    const user = db
      .users()
      .find(
        (u) =>
          u.email.toLowerCase() === String(body.email).toLowerCase() &&
          u.password !== '' &&
          u.password === body.password,
      )
    if (!user) return fail('Invalid email or password.', 'INVALID_CREDENTIALS', 401)
    db.setSession(user.id)
    return ok({ user: publicUser(user) })
  }),

  http.post(route('/auth/logout'), () => {
    db.setSession(null)
    return ok({ message: 'Logged out' })
  }),

  http.get(route('/session'), () => {
    const user = currentUser()
    if (!user) return fail('Not authenticated', 'UNAUTHENTICATED', 401)
    return ok({ user: publicUser(user) })
  }),

  // ---- checkout & orders ----
  http.post(route('/checkout'), async ({ request }) => {
    const user = currentUser()
    if (!user) return fail('Not authenticated', 'UNAUTHENTICATED', 401)

    const body = (await request.json()) as CheckoutRequest
    if (!storeInfo().isOpen) return fail('The store is closed.', 'STORE_CLOSED', 409)

    const { name, phone, email } = body.contact ?? { name: '', phone: '', email: '' }
    if (!name?.trim() || !phone?.trim() || !/^\S+@\S+\.\S+$/.test(email ?? '')) {
      return fail('Contact details are incomplete.', 'VALIDATION_ERROR', 422)
    }
    if (body.fulfillmentType === 'delivery' && !body.deliveryAddress?.trim()) {
      return fail('A delivery address is required.', 'DELIVERY_ADDRESS_REQUIRED', 422)
    }
    if (body.paymentMethod === 'card' && !paymentsEnabled()) {
      return fail('Card payments are not available.', 'PAYMENT_METHOD_UNAVAILABLE', 409)
    }
    if (body.paymentMethod !== 'card' && body.paymentMethod !== 'counter') {
      return fail('Invalid payment method.', 'PAYMENT_METHOD_INVALID', 422)
    }

    try {
      const orders = db.orders()
      const quote = quoteCart(
        body.items,
        body.fulfillmentType,
        body.promoCode,
        orders.some((o) => o.userId === user.id),
      )
      if (body.promoCode && !quote.promo?.valid) {
        return fail('Promo code is not valid.', quote.promo?.reason ?? 'PROMO_NOT_FOUND', 422)
      }

      const order: MockOrder = {
        id: Math.max(0, ...orders.map((o) => o.id)) + 1,
        userId: user.id,
        createdAt: Date.now(),
        status: 'received',
        cancelledAt: null,
        paidAt: null,
        refunded: false,
        request: body,
        lines: quote.lines,
        quote: {
          subtotal: quote.subtotal,
          discount: quote.discount,
          serviceFee: quote.serviceFee,
          deliveryFee: quote.deliveryFee,
          tax: quote.tax,
          total: quote.total,
        },
        promoCode: quote.promo?.valid ? quote.promo.code : null,
      }
      db.saveOrders([...orders, order])
      return ok(
        {
          orderId: order.id,
          orderNumber: `FS-${1000 + order.id}`,
          total: quote.total,
          ...(body.paymentMethod === 'card' ? { clientSecret: `mock_secret_${order.id}` } : {}),
        },
        201,
      )
    } catch (error) {
      return validationFailure(error)
    }
  }),

  // Stand-in for Stripe + its webhook in demo mode. 4000 0000 0000 9995 is Stripe's "declined" test card.
  http.post(route('/_mock/payments/:id/confirm'), async ({ params, request }) => {
    const user = currentUser()
    if (!user) return fail('Not authenticated', 'UNAUTHENTICATED', 401)
    const orders = db.orders()
    const order = orders.find((o) => o.id === Number(params.id))
    if (!order || order.userId !== user.id) return fail('Order not found.', 'RECORD_NOT_FOUND', 404)

    const { cardNumber } = (await request.json()) as { cardNumber: string }
    if (String(cardNumber).replace(/\s/g, '') === '4000000000009995') {
      return fail('Your card was declined.', 'CARD_DECLINED', 402)
    }
    if (order.paidAt === null) {
      order.paidAt = Date.now()
      db.saveOrders(orders)
    }
    return ok({ status: 'paid' })
  }),

  http.get(route('/me/orders'), ({ request }) => {
    const user = currentUser()
    if (!user) return fail('Not authenticated', 'UNAUTHENTICATED', 401)
    const url = new URL(request.url)
    const lang = langOf(url)
    const status = url.searchParams.get('status')
    const page = Math.max(1, Number(url.searchParams.get('page') ?? 1))
    const pageSize = Math.max(1, Number(url.searchParams.get('pageSize') ?? 5))

    const active = new Set<OrderStatus>(['pending_payment', 'received', 'preparing', 'ready'])
    const mine = db
      .orders()
      .filter((o) => o.userId === user.id)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((o) => toSummary(o, lang))
      .filter((o) => {
        if (!status || status === 'all') return true
        if (status === 'active') return active.has(o.status)
        return o.status === status
      })

    return ok({
      items: mine.slice((page - 1) * pageSize, page * pageSize),
      page,
      pageSize,
      total: mine.length,
    })
  }),

  http.get(route('/orders/:id'), ({ params, request }) => {
    const user = currentUser()
    if (!user) return fail('Not authenticated', 'UNAUTHENTICATED', 401)
    const order = db.orders().find((o) => o.id === Number(params.id))
    if (!order) return fail('Order not found.', 'RECORD_NOT_FOUND', 404)
    if (order.userId !== user.id && user.role === 'customer') {
      return fail('Forbidden', 'FORBIDDEN', 403)
    }
    return ok(toDetail(order, langOf(new URL(request.url))))
  }),

  http.post(route('/orders/:id/cancel'), ({ params }) => {
    const user = currentUser()
    if (!user) return fail('Not authenticated', 'UNAUTHENTICATED', 401)
    const orders = db.orders()
    const order = orders.find((o) => o.id === Number(params.id))
    if (!order) return fail('Order not found.', 'RECORD_NOT_FOUND', 404)
    if (order.userId !== user.id && user.role === 'customer') {
      return fail('Forbidden', 'FORBIDDEN', 403)
    }
    // Customers can only cancel before the kitchen accepts (while "received").
    if (statusOf(order) !== 'received') {
      return fail('This order can no longer be cancelled.', 'ORDER_CANCEL_NOT_ALLOWED', 403)
    }
    order.status = 'cancelled'
    order.cancelledAt = Date.now()
    if (isCard(order) && order.paidAt !== null) order.refunded = true
    db.saveOrders(orders)
    return ok({ status: 'cancelled' })
  }),
]

function publicUser(user: MockUser) {
  return {
    id: user.id,
    name: user.name,
    lastname: user.lastname,
    email: user.email,
    role: user.role,
  }
}
