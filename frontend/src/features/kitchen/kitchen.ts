import type { KitchenStatus, KitchenTicket, OrderStatus } from '../../lib/api/types'

/** "Luis Romero" -> "Luis R." (first name and last initial, as on the kitchen tickets). */
export function shortName(name: string): string {
  const parts = name.trim().split(/\s+/)
  return parts.length < 2 ? parts[0] : `${parts[0]} ${parts[parts.length - 1][0]}.`
}

/** 42 -> "0:42", 372 -> "6:12". */
export function formatTimer(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

/** 700 -> "11:40" (avg. prep) and for KPI cards "11m 40s". */
export function formatPrepSeconds(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds))
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`
}

/** The one forward move the kitchen can make from each column. */
export const NEXT_STATUS: Record<Exclude<KitchenStatus, 'completed'>, OrderStatus> = {
  received: 'preparing',
  preparing: 'ready',
  ready: 'completed',
}

export type KitchenAction = 'accept' | 'markReady' | 'pickedUp' | 'handToRider'

export function actionFor(
  ticket: Pick<KitchenTicket, 'status' | 'fulfillmentType'>,
): KitchenAction | null {
  switch (ticket.status) {
    case 'received':
      return 'accept'
    case 'preparing':
      return 'markReady'
    case 'ready':
      return ticket.fulfillmentType === 'delivery' ? 'handToRider' : 'pickedUp'
    default:
      return null
  }
}

/** Minutes over the target time, for the "Over target time by N min" warning. */
export function minutesOverTarget(ticket: KitchenTicket, now: number): number {
  const elapsed = (now - Date.parse(ticket.createdAt)) / 60_000
  return Math.max(0, Math.ceil(elapsed - ticket.targetMinutes))
}
