import { forwardRef, useId } from 'react'
import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react'
import type { LucideIcon } from '../icons'
import { Check } from '../icons'
import './Controls.css'

/* ---- Checkbox -------------------------------------------------------------------------- */

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  /** Visible label content (name, price hint…). */
  children: ReactNode
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { children, className, ...rest },
  ref,
) {
  return (
    <label className={['fs-checkbox', className].filter(Boolean).join(' ')}>
      <input ref={ref} type="checkbox" {...rest} />
      <span className="fs-checkbox__box" aria-hidden="true">
        <Check size={14} />
      </span>
      <span className="fs-checkbox__label">{children}</span>
    </label>
  )
})

/* ---- Textarea -------------------------------------------------------------------------- */

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, id, className, ...rest },
  ref,
) {
  const generated = useId()
  const textareaId = id ?? generated
  return (
    <div className={['fs-textarea', className].filter(Boolean).join(' ')}>
      <label htmlFor={textareaId}>{label}</label>
      <textarea ref={ref} id={textareaId} {...rest} />
    </div>
  )
})

/* ---- SegmentedControl ------------------------------------------------------------------ */

type SegmentedOption<T extends string> = { value: T; label: string; icon?: LucideIcon }

type SegmentedControlProps<T extends string> = {
  options: SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  ariaLabel: string
  className?: string
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={['fs-segmented', className].filter(Boolean).join(' ')}
    >
      {options.map(({ value: optionValue, label, icon: Icon }) => (
        <button
          key={optionValue}
          type="button"
          role="radio"
          aria-checked={optionValue === value}
          className="fs-segmented__option"
          onClick={() => onChange(optionValue)}
        >
          {Icon && <Icon size={16} aria-hidden="true" />}
          {label}
        </button>
      ))}
    </div>
  )
}

/* ---- RadioCard ------------------------------------------------------------------------- */

type RadioCardProps = {
  name: string
  checked: boolean
  onChange: () => void
  title: string
  description?: string
  icon?: LucideIcon
  disabled?: boolean
  /** Small trailing tag, e.g. "Coming soon". */
  tag?: string
}

export function RadioCard({
  name,
  checked,
  onChange,
  title,
  description,
  icon: Icon,
  disabled,
  tag,
}: RadioCardProps) {
  return (
    <label className="fs-radio-card" data-checked={checked} data-disabled={disabled}>
      <input type="radio" name={name} checked={checked} disabled={disabled} onChange={onChange} />
      {Icon && (
        <span className="fs-radio-card__icon" aria-hidden="true">
          <Icon size={20} />
        </span>
      )}
      <span className="fs-radio-card__text">
        <span className="fs-radio-card__title">{title}</span>
        {description && <span className="fs-radio-card__desc">{description}</span>}
      </span>
      {tag && <span className="fs-radio-card__tag">{tag}</span>}
      <span className="fs-radio-card__dot" aria-hidden="true" />
    </label>
  )
}

/* ---- Feedback -------------------------------------------------------------------------- */

export function Skeleton({
  className,
  style,
}: {
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <span
      className={['fs-skeleton', className].filter(Boolean).join(' ')}
      style={style}
      aria-hidden="true"
    />
  )
}

type ErrorBannerProps = { message: string; retryLabel?: string; onRetry?: () => void }

export function ErrorBanner({ message, retryLabel, onRetry }: ErrorBannerProps) {
  return (
    <div className="fs-error-banner" role="alert">
      <span>{message}</span>
      {onRetry && retryLabel && (
        <button type="button" onClick={onRetry}>
          {retryLabel}
        </button>
      )}
    </div>
  )
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="fs-empty">
      <h2 className="t-h4">{title}</h2>
      {description && <p>{description}</p>}
      {action}
    </div>
  )
}
