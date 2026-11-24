/**
 * A card order exists as soon as checkout starts, but the cart is only emptied once payment is
 * confirmed. The order id is parked in sessionStorage so the tracking page (reached after a 3-D
 * Secure redirect or the webhook catching up) knows it may clear the cart.
 */
const KEY = 'foodstack-pending-order'

export function markPendingOrder(orderId: number): void {
  try {
    window.sessionStorage.setItem(KEY, String(orderId))
  } catch {
    /* storage unavailable: the cart simply stays until the customer empties it */
  }
}

export function readPendingOrder(): number | null {
  try {
    const value = Number(window.sessionStorage.getItem(KEY))
    return Number.isFinite(value) && value > 0 ? value : null
  } catch {
    return null
  }
}

export function clearPendingOrder(): void {
  try {
    window.sessionStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
