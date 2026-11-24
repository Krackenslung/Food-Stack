import { Trending } from '../icons'
import type { LucideIcon } from '../icons'
import './KpiCard.css'

type KpiCardProps = {
  label: string
  value: string
  /** e.g. "▲ 12.4%". */
  delta?: string
  deltaTone?: 'success' | 'danger'
  /** e.g. "vs. last week". */
  period?: string
  icon?: LucideIcon
  className?: string
}

export function KpiCard({
  label,
  value,
  delta,
  deltaTone = 'success',
  period,
  icon: Icon = Trending,
  className,
}: KpiCardProps) {
  return (
    <div className={['fs-kpi', className].filter(Boolean).join(' ')}>
      <div className="fs-kpi__top">
        <span className="fs-kpi__label">{label}</span>
        <span className="fs-kpi__tile">
          <Icon size={18} aria-hidden="true" />
        </span>
      </div>
      <div className="fs-kpi__value">{value}</div>
      {(delta || period) && (
        <div className="fs-kpi__delta-row">
          {delta && <span className={`fs-kpi__delta fs-kpi__delta--${deltaTone}`}>{delta}</span>}
          {period && <span className="fs-kpi__period">{period}</span>}
        </div>
      )}
    </div>
  )
}
