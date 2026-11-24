import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { StateStorage } from 'zustand/middleware'
import type { CartLineInput, FulfillmentType } from '../../lib/api/types'

export type CartIngredient = {
  productIngredientId: number
  name: string
  quantity: number
  /** Included quantity, to describe the change ("No onions", "Extra cheese ×2"). */
  default: number
}

export type CartItem = {
  key: string
  productId: number
  name: string
  image: string
  quantity: number
  ingredients: CartIngredient[]
  notes: string
}

export type NewCartItem = Omit<CartItem, 'key'>

/** Identical product + customization + notes merge into one line. */
export function cartItemKey(
  item: Pick<NewCartItem, 'productId' | 'ingredients' | 'notes'>,
): string {
  const choices = [...item.ingredients]
    .sort((a, b) => a.productIngredientId - b.productIngredientId)
    .map((i) => `${i.productIngredientId}:${i.quantity}`)
    .join(',')
  return `${item.productId}|${choices}|${item.notes.trim().toLowerCase()}`
}

type CartState = {
  items: CartItem[]
  promoCode: string
  fulfillmentType: FulfillmentType
  add: (item: NewCartItem) => void
  /** Replace an existing line (Edit in the cart); merges if the new key already exists. */
  replace: (key: string, item: NewCartItem) => void
  setQuantity: (key: string, quantity: number) => void
  remove: (key: string) => void
  setPromoCode: (code: string) => void
  setFulfillmentType: (type: FulfillmentType) => void
  clear: () => void
}

export const MAX_LINE_QUANTITY = 20

const clampQuantity = (quantity: number) => Math.max(1, Math.min(MAX_LINE_QUANTITY, quantity))

function merge(items: CartItem[], incoming: NewCartItem): CartItem[] {
  const key = cartItemKey(incoming)
  const existing = items.find((item) => item.key === key)
  if (!existing) return [...items, { ...incoming, key, quantity: clampQuantity(incoming.quantity) }]
  return items.map((item) =>
    item.key === key
      ? { ...item, quantity: clampQuantity(item.quantity + incoming.quantity) }
      : item,
  )
}

/** localStorage when usable; otherwise a throwaway in-memory store (blocked storage, SSR, tests). */
function safeStorage(): StateStorage {
  try {
    if (window.localStorage) return window.localStorage
  } catch {
    /* fall through to memory */
  }
  const memory = new Map<string, string>()
  return {
    getItem: (name) => memory.get(name) ?? null,
    setItem: (name, value) => void memory.set(name, value),
    removeItem: (name) => void memory.delete(name),
  }
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      promoCode: '',
      fulfillmentType: 'pickup',
      add: (item) => set((state) => ({ items: merge(state.items, item) })),
      replace: (key, item) =>
        set((state) => {
          const index = state.items.findIndex((i) => i.key === key)
          if (index === -1) return { items: merge(state.items, item) }
          const without = state.items.filter((i) => i.key !== key)
          // Keep the edited line where it was when its key does not collide with another line.
          const newKey = cartItemKey(item)
          if (without.some((i) => i.key === newKey)) return { items: merge(without, item) }
          const next = [...without]
          next.splice(index, 0, { ...item, key: newKey, quantity: clampQuantity(item.quantity) })
          return { items: next }
        }),
      setQuantity: (key, quantity) =>
        set((state) => ({
          items: state.items.map((item) =>
            item.key === key ? { ...item, quantity: clampQuantity(quantity) } : item,
          ),
        })),
      remove: (key) => set((state) => ({ items: state.items.filter((item) => item.key !== key) })),
      setPromoCode: (promoCode) => set({ promoCode }),
      setFulfillmentType: (fulfillmentType) => set({ fulfillmentType }),
      clear: () => set({ items: [], promoCode: '' }),
    }),
    {
      name: 'foodstack-cart',
      storage: createJSONStorage(safeStorage),
      version: 1,
    },
  ),
)

export const selectCartCount = (state: CartState) =>
  state.items.reduce((sum, item) => sum + item.quantity, 0)

/** Payload for /cart/quote and /checkout: the server re-prices everything. */
export function toLineInputs(items: CartItem[]): CartLineInput[] {
  return items.map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
    ingredients: item.ingredients.map(({ productIngredientId, quantity }) => ({
      productIngredientId,
      quantity,
    })),
    notes: item.notes.trim() || undefined,
  }))
}
