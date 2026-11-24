import type { ReactNode } from 'react'
import './Badge.css'

export type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'brand'

type BadgeProps = {
  tone?: BadgeTone
  children: ReactNode
  className?: string
}

/**
 * Order status → tone: New=info, Preparing=brand, Ready=success,
 * Completed=neutral, Cancelled=danger.
 */
export const ORDER_STATUS_TONE: Record<string, BadgeTone> = {
  received: 'info',
  pending_payment: 'warning',
  preparing: 'brand',
  ready: 'success',
  completed: 'neutral',
  cancelled: 'danger',
}

export function Badge({ tone = 'neutral', children, className }: BadgeProps) {
  return (
    <span className={['fs-badge', `fs-badge--${tone}`, className].filter(Boolean).join(' ')}>
      <span className="fs-badge__dot" aria-hidden="true" />
      {children}
    </span>
  )
}
