/**
 * Mock order lifecycle. Mirrors backend/Services/order_service.py (state machine, roles) and
 * the stock/refund side effects, so kitchen and admin screens exercise the same rules.
 *
 * Orders placed through checkout "auto-progress" with time so a customer demo moves on its own.
 * The moment staff act on one it is materialized and from then on only staff move it.
 */
import type { OrderHistoryEntry, OrderStatus, OrderSummary } from '../lib/api/types'
import type { Language } from '../lib/language'
import type { MockProduct } from './catalog'
import { db } from './db'
import type { MockOrder } from './db'
import { quoteCart } from './pricing'

export const RECEIVED_FOR_MS = 20_000
export const PREPARING_FOR_MS = 60_000

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending_payment: ['received', 'cancelled'],
  received: ['preparing', 'cancelled'],
  preparing: ['ready'],
  ready: ['completed'],
  completed: [],
  cancelled: [],
}

export class MockOrderError extends Error {
  constructor(
    message: string,
    readonly errorCode: string,
    readonly httpStatus: number,
  ) {
    super(message)
  }
}

export const isCard = (order: MockOrder) => order.request.paymentMethod === 'card'

function autoTimeline(order: MockOrder) {
  const base = order.paidAt ?? order.createdAt
  return { base, preparingAt: base + RECEIVED_FOR_MS, readyAt: base + PREPARING_FOR_MS }
}

export function statusOf(order: MockOrder, now = Date.now()): OrderStatus {
  if (!order.auto) return order.status
  if (order.status === 'cancelled' || order.status === 'completed') return order.status
  if (isCard(order) && order.paidAt === null) return 'pending_payment'
  const { preparingAt, readyAt } = autoTimeline(order)
  if (now < preparingAt) return 'received'
  if (now < readyAt) return 'preparing'
  return 'ready'
}

export function historyOf(order: MockOrder, now = Date.now()): OrderHistoryEntry[] {
  if (!order.auto) return order.history

  const iso = (ms: number) => new Date(ms).toISOString()
  const entries: OrderHistoryEntry[] = []
  let from: OrderStatus | null = null
  const push = (to: OrderStatus, at: number) => {
    entries.push({ fromStatus: from, toStatus: to, createdAt: iso(at) })
    from = to
  }

  const { base, preparingAt, readyAt } = autoTimeline(order)
  if (isCard(order)) push('pending_payment', order.createdAt)
  if (!isCard(order) || order.paidAt !== null) push('received', base)
  if (order.status === 'cancelled') {
    push('cancelled', order.cancelledAt ?? now)
    return entries
  }
  if (from === 'received' && now >= preparingAt) push('preparing', preparingAt)
  if (from === 'preparing' && now >= readyAt) push('ready', readyAt)
  return entries
}

/** When the order entered its current status. */
export function statusSince(order: MockOrder, now = Date.now()): number {
  if (!order.auto) return order.statusSince
  const { base, preparingAt, readyAt } = autoTimeline(order)
  switch (statusOf(order, now)) {
    case 'pending_payment':
      return order.createdAt
    case 'received':
      return base
    case 'preparing':
      return preparingAt
    case 'ready':
      return readyAt
    default:
      return order.cancelledAt ?? base
  }
}

/** Freeze an auto-progressing order at its current state so staff can drive it. */
function materialize(order: MockOrder, now: number) {
  if (!order.auto) return
  order.history = historyOf(order, now)
  order.statusSince = statusSince(order, now)
  order.status = statusOf(order, now)
  order.auto = false
}

/** Stock and promo are consumed when an order reaches "received" and returned on cancel. */
export function consumeStock(order: MockOrder, direction: 1 | -1) {
  if (direction === 1 && order.stockConsumed) return
  if (direction === -1 && !order.stockConsumed) return
  const products = db.products()
  for (const line of order.lines) {
    const product = products.find((p) => p.id === line.productId)
    if (product && product.stock !== null) {
      product.stock = Math.max(0, product.stock - direction * line.quantity)
    }
  }
  db.saveProducts(products)
  order.stockConsumed = direction === 1
}

/** staff/admin move orders through the kitchen; same rules as order_service.validate_transition. */
export function applyTransition(
  order: MockOrder,
  target: OrderStatus,
  role: string,
  now = Date.now(),
) {
  materialize(order, now)
  const current = order.status

  if (!(target in TRANSITIONS)) {
    throw new MockOrderError('Unknown order status.', 'ORDER_STATUS_INVALID', 422)
  }
  if (!TRANSITIONS[current].includes(target)) {
    throw new MockOrderError(
      `Cannot move an order from ${current} to ${target}.`,
      'ORDER_INVALID_TRANSITION',
      409,
    )
  }
  if (role === 'customer') {
    // Customers may only cancel, and only before the kitchen accepts the order.
    if (target !== 'cancelled' || current !== 'received') {
      throw new MockOrderError(
        'This order can no longer be cancelled.',
        'ORDER_CANCEL_NOT_ALLOWED',
        403,
      )
    }
  } else if (role !== 'staff' && role !== 'admin' && role !== 'system') {
    throw new MockOrderError('Forbidden', 'FORBIDDEN', 403)
  }
  if (role !== 'system' && current === 'pending_payment' && target === 'received') {
    throw new MockOrderError(
      'Only a confirmed payment can move an order to received.',
      'ORDER_INVALID_TRANSITION',
      409,
    )
  }

  order.history.push({
    fromStatus: current,
    toStatus: target,
    createdAt: new Date(now).toISOString(),
  })
  order.status = target
  order.statusSince = now
  if (target === 'cancelled') {
    order.cancelledAt = now
    if (isCard(order) && order.paidAt !== null) order.refunded = true
    consumeStock(order, -1)
  }
}

// ---- shared mappers ---------------------------------------------------------------------------

export function productOf(id: number): MockProduct {
  return db.products().find((p) => p.id === id)!
}

export function baseSummary(order: MockOrder): Omit<OrderSummary, 'items'> {
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

export function toSummary(order: MockOrder, lang: Language): OrderSummary {
  return {
    ...baseSummary(order),
    items: order.lines.map((line) => ({
      name: productOf(line.productId).name[lang],
      image: productOf(line.productId).image,
      quantity: line.quantity,
    })),
  }
}

// ---- demo kitchen data -----------------------------------------------------------------------

type DemoOrder = {
  name: string
  items: [number, number][]
  fulfillment: 'pickup' | 'delivery'
  method: 'card' | 'counter'
  status: OrderStatus
  minutesAgo: number
  extras?: { productId: number; ingredientId: number; quantity: number }[]
  notes?: string
}

const DEMO: DemoOrder[] = [
  {
    name: 'Daniel Kim',
    items: [
      [6, 1],
      [10, 1],
    ],
    fulfillment: 'delivery',
    method: 'card',
    status: 'received',
    minutesAgo: 0.25,
  },
  {
    name: 'Luis Romero',
    items: [
      [10, 2],
      [13, 1],
    ],
    fulfillment: 'pickup',
    method: 'card',
    status: 'received',
    minutesAgo: 0.7,
  },
  {
    name: 'Sofía Méndez',
    items: [[2, 1]],
    fulfillment: 'delivery',
    method: 'counter',
    status: 'preparing',
    minutesAgo: 6.2,
  },
  {
    name: 'Carlos Ruiz',
    items: [
      [5, 1],
      [10, 1],
    ],
    fulfillment: 'pickup',
    method: 'card',
    status: 'preparing',
    minutesAgo: 8.5,
  },
  {
    name: 'Elena Vega',
    items: [
      [1, 2],
      [14, 2],
    ],
    fulfillment: 'pickup',
    method: 'card',
    status: 'preparing',
    minutesAgo: 14.1,
    notes: 'Well done',
  },
  {
    name: 'Valeria Torres',
    items: [[1, 2]],
    fulfillment: 'pickup',
    method: 'counter',
    status: 'ready',
    minutesAgo: 18,
  },
  {
    name: 'Marco Arias',
    items: [
      [6, 1],
      [13, 1],
    ],
    fulfillment: 'delivery',
    method: 'card',
    status: 'ready',
    minutesAgo: 22,
  },
  {
    name: 'Ana García',
    items: [
      [1, 1],
      [6, 1],
    ],
    fulfillment: 'pickup',
    method: 'card',
    status: 'completed',
    minutesAgo: 41,
  },
  {
    name: 'Paola Sánchez',
    items: [[2, 1]],
    fulfillment: 'pickup',
    method: 'counter',
    status: 'completed',
    minutesAgo: 55,
  },
  {
    name: 'Iván Gómez',
    items: [[5, 1]],
    fulfillment: 'delivery',
    method: 'card',
    status: 'cancelled',
    minutesAgo: 62,
  },
]

const STEP_ORDER: OrderStatus[] = ['received', 'preparing', 'ready', 'completed']

/** Seed some kitchen traffic the first time a staff/admin screen asks for orders. */
export function ensureDemoOrders() {
  const orders = db.orders()
  if (orders.some((order) => order.demo)) return

  const now = Date.now()
  let nextId = Math.max(0, ...orders.map((order) => order.id)) + 1

  for (const demo of DEMO) {
    const items = demo.items.map(([productId, quantity]) => ({
      productId,
      quantity,
      ingredients: [],
      notes: demo.notes,
    }))
    const quote = quoteCart(items, demo.fulfillment, undefined, false)
    const createdAt = now - demo.minutesAgo * 60_000

    // Walk the order through the statuses up to its target, one minute apart.
    const history: OrderHistoryEntry[] = []
    let from: OrderStatus | null = null
    const push = (to: OrderStatus, at: number) => {
      history.push({ fromStatus: from, toStatus: to, createdAt: new Date(at).toISOString() })
      from = to
    }
    push('received', createdAt)
    if (demo.status === 'cancelled') {
      push('cancelled', createdAt + 60_000)
    } else {
      const steps = STEP_ORDER.indexOf(demo.status)
      for (let i = 1; i <= steps; i++) push(STEP_ORDER[i], createdAt + i * 4 * 60_000)
    }

    const order: MockOrder = {
      id: nextId++,
      userId: -nextId, // not a real account
      createdAt,
      status: demo.status,
      cancelledAt: demo.status === 'cancelled' ? createdAt + 60_000 : null,
      paidAt: demo.method === 'card' ? createdAt : null,
      refunded: demo.status === 'cancelled' && demo.method === 'card',
      auto: false,
      history,
      statusSince: new Date(history[history.length - 1].createdAt).getTime(),
      stockConsumed: false,
      demo: true,
      request: {
        items,
        fulfillmentType: demo.fulfillment,
        contact: {
          name: demo.name,
          phone: '+1 619 555 0148',
          email: `${demo.name.split(' ')[0].toLowerCase()}@example.com`,
        },
        deliveryAddress:
          demo.fulfillment === 'delivery' ? 'Av. Revolución 1200, Tijuana' : undefined,
        paymentMethod: demo.method,
      },
      lines: quote.lines,
      quote: {
        subtotal: quote.subtotal,
        discount: quote.discount,
        serviceFee: quote.serviceFee,
        deliveryFee: quote.deliveryFee,
        tax: quote.tax,
        total: quote.total,
      },
      promoCode: null,
    }
    orders.push(order)
  }
  db.saveOrders(orders)
}
