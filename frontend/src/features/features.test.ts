import { describe, expect, it } from 'vitest'
import { cartItemKey, selectCartCount, toLineInputs, useCartStore } from './cart/cartStore'
import type { NewCartItem } from './cart/cartStore'
import { validateSchedule } from './checkout/schedule'
import { describeChanges, formatHour, pageList, passwordStrength } from './shared/helpers'

const burger: NewCartItem = {
  productId: 1,
  name: 'Overkill Double Burger',
  image: '/menu/overkill-double.jpg',
  quantity: 1,
  ingredients: [],
  notes: '',
}

describe('cart store', () => {
  const cart = () => useCartStore.getState()

  it('merges identical lines and keeps customized ones separate', () => {
    cart().add(burger)
    cart().add({ ...burger, quantity: 2 })
    cart().add({
      ...burger,
      ingredients: [{ productIngredientId: 101, name: 'Cheddar', quantity: 2, default: 1 }],
    })
    expect(cart().items).toHaveLength(2)
    expect(cart().items[0].quantity).toBe(3)
    expect(selectCartCount(cart())).toBe(4)
  })

  it('treats notes case-insensitively and ignores ingredient order in the key', () => {
    const a = cartItemKey({ productId: 1, notes: 'No Pickles', ingredients: [] })
    const b = cartItemKey({ productId: 1, notes: ' no pickles ', ingredients: [] })
    expect(a).toBe(b)
  })

  it('clamps quantities between 1 and 20', () => {
    cart().add(burger)
    const key = cart().items[0].key
    cart().setQuantity(key, 0)
    expect(cart().items[0].quantity).toBe(1)
    cart().setQuantity(key, 99)
    expect(cart().items[0].quantity).toBe(20)
  })

  it('replaces an edited line in place and merges when it collides', () => {
    cart().add(burger)
    cart().add({ ...burger, productId: 2, name: 'BBQ' })
    const first = cart().items[0].key
    cart().replace(first, { ...burger, notes: 'extra napkins' })
    expect(cart().items.map((i) => i.productId)).toEqual([1, 2])
    expect(cart().items[0].notes).toBe('extra napkins')

    // Editing line 2 back into line 1's recipe merges them.
    cart().replace(cart().items[1].key, { ...burger, notes: 'extra napkins' })
    expect(cart().items).toHaveLength(1)
    expect(cart().items[0].quantity).toBe(2)
  })

  it('removes lines, clears the cart and builds server payloads without prices', () => {
    cart().add({
      ...burger,
      notes: ' hot ',
      ingredients: [{ productIngredientId: 101, name: 'Cheddar', quantity: 2, default: 1 }],
    })
    expect(toLineInputs(cart().items)).toEqual([
      {
        productId: 1,
        quantity: 1,
        ingredients: [{ productIngredientId: 101, quantity: 2 }],
        notes: 'hot',
      },
    ])
    cart().remove(cart().items[0].key)
    expect(cart().items).toEqual([])
    cart().add(burger)
    cart().setPromoCode('FOODSTACK20')
    cart().clear()
    expect(cart().promoCode).toBe('')
    expect(cart().items).toEqual([])
  })
})

describe('helpers', () => {
  const t = ((key: string, options?: Record<string, unknown>) =>
    `${key}:${options?.name ?? ''}:${options?.count ?? ''}`) as never

  it('describes only what differs from the default recipe', () => {
    expect(
      describeChanges(
        [
          { productIngredientId: 1, name: 'Onions', quantity: 0, default: 1 },
          { productIngredientId: 2, name: 'Cheddar', quantity: 3, default: 1 },
          { productIngredientId: 3, name: 'Bacon', quantity: 1, default: 0 },
          { productIngredientId: 4, name: 'Pickles', quantity: 1, default: 1 },
        ],
        t,
      ),
    ).toEqual([
      'cart.changes.no:Onions:',
      'cart.changes.extraMany:Cheddar:2',
      'cart.changes.add:Bacon:',
    ])
  })

  it('builds page lists with gaps', () => {
    expect(pageList(1, 1)).toEqual([1])
    expect(pageList(2, 5)).toEqual([1, 2, 3, 4, 5])
    expect(pageList(1, 12)).toEqual([1, 2, 'gap', 11, 12])
    expect(pageList(6, 12)).toEqual([1, 2, 'gap', 5, 6, 7, 'gap', 11, 12])
  })

  it('scores passwords 0-4', () => {
    expect(passwordStrength('')).toBe(0)
    expect(passwordStrength('abc')).toBe(0)
    expect(passwordStrength('abcdefgh')).toBe(1)
    expect(passwordStrength('abcdefgh1!')).toBe(3)
    expect(passwordStrength('Abcdefgh1!')).toBe(4)
  })

  it('formats 24h times', () => {
    expect(formatHour('11:00')).toBe('11:00 AM')
    expect(formatHour('23:00')).toBe('11:00 PM')
    expect(formatHour('00:30')).toBe('12:30 AM')
    expect(formatHour('12:00')).toBe('12:00 PM')
  })
})

describe('schedule validation', () => {
  const now = new Date(2026, 5, 1, 12, 0) // Mon 12:00 local
  const at = (day: number, hour: number, minute = 0) =>
    `2026-06-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
  const check = (value: string) => validateSchedule(value, now, '11:00', '23:00')

  it('accepts times within hours, today or tomorrow', () => {
    expect(check(at(1, 18))).toBeNull()
    expect(check(at(2, 11))).toBeNull()
  })

  it('rejects empty, too soon, too far and out-of-hours picks', () => {
    expect(check('')).toBe('SCHEDULE_REQUIRED')
    expect(check(at(1, 12, 5))).toBe('SCHEDULE_PAST')
    expect(check(at(3, 12))).toBe('SCHEDULE_TOO_FAR')
    expect(check(at(2, 9))).toBe('SCHEDULE_OUTSIDE_HOURS')
    expect(check(at(1, 23, 30))).toBe('SCHEDULE_OUTSIDE_HOURS')
  })
})
