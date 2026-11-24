import { describe, expect, it } from 'vitest'
import en from './en.json'

function has(tree: unknown, path: string): boolean {
  let node = tree as Record<string, unknown> | undefined
  for (const part of path.split('.')) {
    if (typeof node !== 'object' || node === null || !(part in node)) {
      // Plural keys are stored as key_one / key_other.
      return path.split('.').pop() === part && '' + part + '_other' in (node ?? {})
    }
    node = node[part] as Record<string, unknown>
  }
  return true
}

// Every source file under src/, loaded as text.
const sources = import.meta.glob('/src/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

describe('translation keys used in code', () => {
  const used = new Map<string, string>()
  for (const [file, code] of Object.entries(sources)) {
    if (file.includes('.test.') || file.includes('/mocks/')) continue
    // Static keys only: t('some.key') / t("some.key"). Template keys (t(`a.${b}`)) are covered by
    // the explicit list below.
    for (const match of code.matchAll(/\bt\(\s*['"]([a-zA-Z0-9_.]+)['"]/g)) {
      used.set(match[1], file)
    }
  }

  it('finds a healthy number of keys', () => {
    expect(used.size).toBeGreaterThan(100)
  })

  it('has every static key in en.json', () => {
    const missing = [...used]
      .filter(([key]) => !has(en, key))
      .map(([key, file]) => `${key} (${file})`)
    expect(missing).toEqual([])
  })

  it('covers every dynamic key family', () => {
    const families = [
      ...['pending_payment', 'received', 'preparing', 'ready', 'completed', 'cancelled'].flatMap(
        (s) => [`orders.status.${s}`, `tracking.title.${s}`, `tracking.subtitle.${s}`],
      ),
      ...['received', 'preparing', 'ready', 'completed'].flatMap((s) =>
        ['pickup', 'delivery'].map((f) => `tracking.steps.${f}.${s}`),
      ),
      ...['unpaid', 'paid', 'failed', 'refunded', 'pay_at_counter'].map(
        (p) => `tracking.payment.${p}`,
      ),
      ...['all', 'active', 'completed', 'cancelled'].map((f) => `orders.filter.${f}`),
      ...[0, 1, 2, 3, 4].map((n) => `auth.strength.${n}`),
      ...['pickup', 'delivery'].flatMap((f) => [`cart.${f}`, `checkout.${f}Desc`]),
      ...['SCHEDULE_REQUIRED', 'SCHEDULE_PAST', 'SCHEDULE_TOO_FAR', 'SCHEDULE_OUTSIDE_HOURS'].map(
        (c) => `checkout.errors.${c}`,
      ),
      ...['pick', 'customize', 'track'].flatMap((s) => [
        `landing.steps.${s}.title`,
        `landing.steps.${s}.body`,
      ]),
      ...['PROMO_NOT_FOUND', 'PROMO_FIRST_ORDER_ONLY', 'PROMO_EXPIRED', 'PROMO_MIN_SUBTOTAL'].map(
        (c) => `promo.${c}`,
      ),
    ]
    expect(families.filter((key) => !has(en, key))).toEqual([])
  })
})
