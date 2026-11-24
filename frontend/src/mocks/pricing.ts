/**
 * Mock-server pricing. It mirrors backend/Services/order_service.py (CLAUDE.md "Business
 * rules") using integer cents so every rounding step is exact. The real API is the only
 * source of truth for totals; the UI never computes them.
 */
import type { CartLineInput, FulfillmentType, PromoResult, Quote } from '../lib/api/types'
import { MOCK_PRODUCTS, productIngredientId } from './catalog'

export const MOCK_FEES = {
  /** basis points: 800 = 8% */
  taxRateBp: 800,
  serviceFeeCents: 150,
  deliveryFeeCents: 299,
}

export const MOCK_PROMOS: Record<string, { percentOff: number; firstOrderOnly: boolean }> = {
  FOODSTACK20: { percentOff: 20, firstOrderOnly: true },
}

export function toCents(amount: string): number {
  const [whole, fraction = ''] = amount.split('.')
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0').slice(0, 2))
}

export function fromCents(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`
}

/** ROUND_HALF_UP for non-negative integer ratios. */
function roundDiv(numerator: number, denominator: number): number {
  return Math.floor((numerator * 2 + denominator) / (denominator * 2))
}

export class MockValidationError extends Error {
  constructor(
    message: string,
    readonly errorCode: string,
  ) {
    super(message)
  }
}

function priceLine(item: CartLineInput) {
  const product = MOCK_PRODUCTS.find((p) => p.id === item.productId)
  if (!product) throw new MockValidationError('Unknown product.', 'PRODUCT_NOT_FOUND')
  if (!Number.isInteger(item.quantity) || item.quantity < 1) {
    throw new MockValidationError('Quantity must be at least 1.', 'QUANTITY_INVALID')
  }

  let extrasCents = 0
  for (const choice of item.ingredients) {
    const index = product.ingredients.findIndex(
      (_, i) => productIngredientId(product.id, i) === choice.productIngredientId,
    )
    const rule = product.ingredients[index]
    if (!rule) throw new MockValidationError('Unknown ingredient.', 'INGREDIENT_NOT_FOUND')
    if (choice.quantity < 0 || choice.quantity > rule.max) {
      throw new MockValidationError('Too many of an ingredient.', 'INGREDIENT_QUANTITY_EXCEEDS_MAX')
    }
    if (choice.quantity < rule.default && !rule.removable) {
      throw new MockValidationError(
        'This ingredient cannot be removed.',
        'INGREDIENT_NOT_REMOVABLE',
      )
    }
    if (!product.allowCustomization && choice.quantity !== rule.default) {
      throw new MockValidationError('Not customizable.', 'PRODUCT_NOT_CUSTOMIZABLE')
    }
    // Removing an ingredient never lowers the price.
    extrasCents += Math.max(0, choice.quantity - rule.default) * toCents(rule.extraPrice)
  }

  const unitCents = toCents(product.price)
  return {
    productId: product.id,
    quantity: item.quantity,
    unitPrice: fromCents(unitCents),
    extras: fromCents(extrasCents),
    lineTotal: fromCents((unitCents + extrasCents) * item.quantity),
  }
}

export function quoteCart(
  items: CartLineInput[],
  fulfillmentType: FulfillmentType,
  promoCode: string | undefined,
  hasPriorOrder: boolean,
): Quote {
  if (items.length === 0) throw new MockValidationError('The cart is empty.', 'CART_EMPTY')

  const lines = items.map(priceLine)
  const subtotal = lines.reduce((sum, line) => sum + toCents(line.lineTotal), 0)

  let promo: PromoResult | null = null
  let discount = 0
  const code = promoCode?.trim().toUpperCase()
  if (code) {
    const definition = MOCK_PROMOS[code]
    if (!definition) {
      promo = { code, valid: false, reason: 'PROMO_NOT_FOUND' }
    } else if (definition.firstOrderOnly && hasPriorOrder) {
      promo = { code, valid: false, reason: 'PROMO_FIRST_ORDER_ONLY' }
    } else {
      promo = { code, valid: true, reason: null }
      discount = Math.min(roundDiv(subtotal * definition.percentOff, 100), subtotal)
    }
  }

  const serviceFee = MOCK_FEES.serviceFeeCents
  const deliveryFee = fulfillmentType === 'delivery' ? MOCK_FEES.deliveryFeeCents : 0
  const taxable = subtotal - discount + serviceFee + deliveryFee
  const tax = roundDiv(taxable * MOCK_FEES.taxRateBp, 10000)

  return {
    lines,
    subtotal: fromCents(subtotal),
    discount: fromCents(discount),
    serviceFee: fromCents(serviceFee),
    deliveryFee: fromCents(deliveryFee),
    tax: fromCents(tax),
    total: fromCents(taxable + tax),
    promo,
  }
}
