import { forwardRef, useId } from 'react'
import type { InputHTMLAttributes } from 'react'
import type { LucideIcon } from '../icons'
import './Input.css'

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  label: string
  helper?: string
  /** When set, the field shows the error state and this text replaces the helper. */
  error?: string
  /** Optional leading icon. */
  icon?: LucideIcon
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, helper, error, icon: Icon, id, className, ...rest },
  ref,
) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const messageId = `${inputId}-message`
  const message = error ?? helper

  return (
    <div className={['fs-input', error && 'fs-input--error', className].filter(Boolean).join(' ')}>
      <label className="fs-input__label" htmlFor={inputId}>
        {label}
      </label>
      <div className="fs-input__field">
        {Icon && <Icon size={18} aria-hidden="true" className="fs-input__icon" />}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={message ? messageId : undefined}
          {...rest}
        />
      </div>
      {message && (
        <p id={messageId} className="fs-input__message" role={error ? 'alert' : undefined}>
          {message}
        </p>
      )}
    </div>
  )
})
