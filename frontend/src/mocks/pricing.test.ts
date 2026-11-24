import { describe, expect, it } from 'vitest'
import { productIngredientId } from './catalog'
import { MockValidationError, fromCents, quoteCart, toCents } from './pricing'

// Product 1 = Overkill Double Burger ($12.99); ingredient slot 1 = Aged cheddar (default 1, $1.00).
const cheddar = productIngredientId(1, 1)
const bacon = productIngredientId(1, 2)
const onions = productIngredientId(1, 3)

describe('mock pricing mirrors the backend rules', () => {
  it('converts between decimal strings and cents without drift', () => {
    expect(toCents('12.99')).toBe(1299)
    expect(toCents('0.5')).toBe(50)
    expect(fromCents(2880)).toBe('28.80')
    expect(fromCents(5)).toBe('0.05')
  })

  it('prices extras per unit over the default and applies fees, promo and tax in order', () => {
    const quote = quoteCart(
      [
        // 12.99 + 1 extra cheddar (1.00) = 13.99
        { productId: 1, quantity: 1, ingredients: [{ productIngredientId: cheddar, quantity: 2 }] },
        // Chicken Burrito 8.49 x 1 + guacamole 1.50 = 9.99
        {
          productId: 6,
          quantity: 1,
          ingredients: [{ productIngredientId: productIngredientId(6, 2), quantity: 1 }],
        },
        // Iced Horchata 3.49 x 2 = 6.98
        { productId: 13, quantity: 2, ingredients: [] },
      ],
      'pickup',
      'FOODSTACK20',
      false,
    )
    expect(quote.subtotal).toBe('30.96')
    expect(quote.discount).toBe('6.19') // 20% of 30.96 = 6.192 -> 6.19
    expect(quote.serviceFee).toBe('1.50')
    expect(quote.tax).toBe('2.10') // (30.96 - 6.19 + 1.50) x 8% = 2.1016
    expect(quote.total).toBe('28.37')
    expect(quote.promo).toEqual({ code: 'FOODSTACK20', valid: true, reason: null })
  })

  it('adds the delivery fee before tax', () => {
    const quote = quoteCart(
      [{ productId: 10, quantity: 1, ingredients: [] }],
      'delivery',
      undefined,
      false,
    )
    expect(quote.deliveryFee).toBe('2.99')
    // (3.49 + 1.50 + 2.99) x 0.08 = 0.6384
    expect(quote.tax).toBe('0.64')
    expect(quote.total).toBe('8.62')
  })

  it('never lowers the price when an ingredient is removed', () => {
    const quote = quoteCart(
      [{ productId: 1, quantity: 1, ingredients: [{ productIngredientId: onions, quantity: 0 }] }],
      'pickup',
      undefined,
      false,
    )
    expect(quote.lines[0].lineTotal).toBe('12.99')
  })

  it('rejects limit violations with stable error codes', () => {
    const attempt = (ingredients: { productIngredientId: number; quantity: number }[]) => () =>
      quoteCart([{ productId: 1, quantity: 1, ingredients }], 'pickup', undefined, false)

    expect(attempt([{ productIngredientId: bacon, quantity: 3 }])).toThrow(MockValidationError)
    try {
      attempt([{ productIngredientId: bacon, quantity: 3 }])()
    } catch (error) {
      expect((error as MockValidationError).errorCode).toBe('INGREDIENT_QUANTITY_EXCEEDS_MAX')
    }
    // Beef patty (slot 0) is not removable.
    try {
      attempt([{ productIngredientId: productIngredientId(1, 0), quantity: 0 }])()
    } catch (error) {
      expect((error as MockValidationError).errorCode).toBe('INGREDIENT_NOT_REMOVABLE')
    }
    // Sides do not allow customization.
    expect(() =>
      quoteCart(
        [{ productId: 10, quantity: 1, ingredients: [{ productIngredientId: 1001, quantity: 1 }] }],
        'pickup',
        undefined,
        false,
      ),
    ).toThrow(MockValidationError)
  })

  it('limits the first-order promo to first orders and flags unknown codes', () => {
    const items = [{ productId: 1, quantity: 1, ingredients: [] }]
    expect(quoteCart(items, 'pickup', 'FOODSTACK20', true).promo).toEqual({
      code: 'FOODSTACK20',
      valid: false,
      reason: 'PROMO_FIRST_ORDER_ONLY',
    })
    expect(quoteCart(items, 'pickup', 'nope', false).promo?.reason).toBe('PROMO_NOT_FOUND')
    expect(quoteCart(items, 'pickup', 'nope', false).discount).toBe('0.00')
  })

  it('rejects empty carts and bad quantities', () => {
    expect(() => quoteCart([], 'pickup', undefined, false)).toThrow(MockValidationError)
    expect(() =>
      quoteCart([{ productId: 1, quantity: 0, ingredients: [] }], 'pickup', undefined, false),
    ).toThrow(MockValidationError)
  })
})
