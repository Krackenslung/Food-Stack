import { Minus, Plus } from '../icons'
import './Stepper.css'

type StepperProps = {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  /** Accessible names; pass translated strings. */
  decrementLabel: string
  incrementLabel: string
  className?: string
}

export function Stepper({
  value,
  onChange,
  min = 0,
  max = Number.POSITIVE_INFINITY,
  decrementLabel,
  incrementLabel,
  className,
}: StepperProps) {
  return (
    <div className={['fs-stepper', className].filter(Boolean).join(' ')}>
      <button
        type="button"
        className="fs-stepper__btn"
        aria-label={decrementLabel}
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        <Minus size={16} aria-hidden="true" />
      </button>
      <span className="fs-stepper__value" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        className="fs-stepper__btn fs-stepper__btn--plus"
        aria-label={incrementLabel}
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        <Plus size={16} aria-hidden="true" />
      </button>
    </div>
  )
}
