/** Motion tokens (CLAUDE.md "Animations"). Always respect prefers-reduced-motion. */

export const duration = {
  fast: 0.12,
  base: 0.2,
  slow: 0.32,
} as const

export const easing = {
  standard: [0.2, 0, 0, 1],
  emphasized: [0.3, 0, 0, 1.2],
} as const

/** Page enter: fade + 8px rise. */
export const pageEnter = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: duration.base, ease: easing.standard },
} as const

/** With reduced motion everything becomes a plain opacity change. */
export const reducedMotionVariant = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: duration.fast },
} as const
