import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Dashboard } from '../../lib/api/types'
import { useMoney } from '../shared/queries'
import './RevenueChart.css'

/** Round up to a "nice" axis maximum (1, 2, 2.5, 5 x 10^n) so ticks read well. */
export function niceMax(value: number): number {
  if (value <= 0) return 1
  const magnitude = 10 ** Math.floor(Math.log10(value))
  for (const step of [1, 2, 2.5, 5, 10]) {
    if (value <= step * magnitude) return step * magnitude
  }
  return 10 * magnitude
}

type Props = {
  series: Dashboard['series']
  language: 'en' | 'es'
  /** "7d" shows weekday names; longer ranges show dates, thinned out. */
  range: Dashboard['range']
}

export function RevenueChart({ series, language, range }: Props) {
  const { t } = useTranslation()
  const money = useMoney()
  const [active, setActive] = useState<number | null>(null)

  const locale = language === 'es' ? 'es-MX' : 'en-US'
  const values = series.map((point) => Number(point.revenue))
  const top = niceMax(Math.max(...values))
  const ticks = [1, 0.75, 0.5, 0.25, 0].map((fraction) => top * fraction)
  const shown = active ?? series.length - 1
  const every = range === '7d' ? 1 : range === '30d' ? 5 : 15

  const compact = new Intl.NumberFormat(locale, {
    notation: 'compact',
    maximumFractionDigits: 2,
    style: 'currency',
    currency: 'USD',
  })
  const label = (date: string, long = false) =>
    new Date(`${date}T12:00:00`).toLocaleDateString(
      locale,
      range === '7d' || long
        ? { weekday: 'short', ...(long ? { month: 'short', day: 'numeric' } : {}) }
        : { month: 'short', day: 'numeric' },
    )

  return (
    <div className="fs-chart">
      <ol className="fs-chart__ticks" aria-hidden="true">
        {ticks.map((tick) => (
          <li key={tick}>{compact.format(tick)}</li>
        ))}
      </ol>
      <div className="fs-chart__plot" onMouseLeave={() => setActive(null)}>
        <div className="fs-chart__tooltip" aria-hidden="true">
          <strong>
            {label(series[shown].date, true)} · {money(series[shown].revenue)}
          </strong>
          <span>{t('dashboard.ordersCount', { count: series[shown].orders })}</span>
        </div>
        <ul className="fs-chart__bars">
          {series.map((point, index) => (
            <li key={point.date}>
              <button
                type="button"
                className={
                  index === series.length - 1
                    ? 'fs-chart__bar fs-chart__bar--today'
                    : 'fs-chart__bar'
                }
                style={{ height: `${(Number(point.revenue) / top) * 100}%` }}
                aria-label={t('dashboard.barLabel', {
                  date: label(point.date, true),
                  revenue: money(point.revenue),
                  count: point.orders,
                })}
                onMouseEnter={() => setActive(index)}
                onFocus={() => setActive(index)}
                onBlur={() => setActive(null)}
              />
              <span aria-hidden="true">
                {(series.length - 1 - index) % every === 0 ? label(point.date) : ''}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
