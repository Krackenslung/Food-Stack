/** In-browser "database" for the mock API. Persisted in localStorage so demos survive reloads. */
import type { Role } from '../lib/auth'
import type { CheckoutRequest, OrderHistoryEntry, OrderStatus, QuoteLine } from '../lib/api/types'
import { seedProducts } from './catalog'
import type { MockProduct } from './catalog'

export type MockUser = {
  id: number
  name: string
  lastname: string
  email: string
  phoneNumber: string
  password: string
  role: Role
  /** Set once a Google identity is linked to this account. */
  googleSub?: string
}

export type MockOrder = {
  id: number
  userId: number
  createdAt: number
  status: OrderStatus
  cancelledAt: number | null
  /** Card orders: when the (mock) webhook confirmed payment. Null = still unpaid. */
  paidAt: number | null
  refunded: boolean
  /** true = status advances on its own with time (customer demo); false = staff drive it. */
  auto: boolean
  /** Explicit history/status/statusSince, authoritative once ``auto`` is false. */
  history: OrderHistoryEntry[]
  statusSince: number
  stockConsumed: boolean
  /** Seeded kitchen data (not placed through checkout). */
  demo?: boolean
  request: CheckoutRequest
  lines: QuoteLine[]
  quote: {
    subtotal: string
    discount: string
    serviceFee: string
    deliveryFee: string
    tax: string
    total: string
  }
  promoCode: string | null
}

const KEYS = {
  users: 'foodstack-mock-users',
  orders: 'foodstack-mock-orders',
  session: 'foodstack-mock-session',
  products: 'foodstack-mock-products',
} as const

// Same test accounts as scripts/seed_users.py.
const SEED_USERS: MockUser[] = [
  {
    id: 1,
    name: 'Admin',
    lastname: 'User',
    email: 'admin@foodstack.local',
    phoneNumber: '5551234567',
    password: 'Admin123!',
    role: 'admin',
  },
  {
    id: 2,
    name: 'Staff',
    lastname: 'User',
    email: 'staff@foodstack.local',
    phoneNumber: '5551234567',
    password: 'Staff123!',
    role: 'staff',
  },
  {
    id: 3,
    name: 'Test',
    lastname: 'Customer',
    email: 'customer@foodstack.local',
    phoneNumber: '5551234567',
    password: 'Customer123!',
    role: 'customer',
  },
]

const memory = new Map<string, string>()

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key) ?? memory.get(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown): void {
  const raw = JSON.stringify(value)
  memory.set(key, raw)
  try {
    window.localStorage.setItem(key, raw)
  } catch {
    /* storage unavailable: memory copy keeps the session working */
  }
}

export const db = {
  users: (): MockUser[] => read(KEYS.users, SEED_USERS),
  saveUsers: (users: MockUser[]) => write(KEYS.users, users),

  orders: (): MockOrder[] => read(KEYS.orders, [] as MockOrder[]),
  saveOrders: (orders: MockOrder[]) => write(KEYS.orders, orders),

  products: (): MockProduct[] => read(KEYS.products, seedProducts()),
  saveProducts: (products: MockProduct[]) => write(KEYS.products, products),

  sessionUserId: (): number | null => read<number | null>(KEYS.session, null),
  setSession: (userId: number | null) => write(KEYS.session, userId),

  reset() {
    for (const key of Object.values(KEYS)) {
      memory.delete(key)
      try {
        window.localStorage.removeItem(key)
      } catch {
        /* ignore */
      }
    }
  },
}
