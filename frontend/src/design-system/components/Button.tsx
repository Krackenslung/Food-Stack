import type { ButtonHTMLAttributes } from 'react'
import type { LucideIcon } from '../icons'
import './Button.css'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'dark'
export type ButtonSize = 'M' | 'L'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Optional trailing icon. */
  icon?: LucideIcon
}

export function Button({
  variant = 'primary',
  size = 'M',
  icon: Icon,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  const classes = ['fs-btn', `fs-btn--${variant}`, `fs-btn--${size.toLowerCase()}`, className]
    .filter(Boolean)
    .join(' ')

  return (
    <button type={type} className={classes} {...rest}>
      <span>{children}</span>
      {Icon && <Icon size={size === 'L' ? 20 : 18} aria-hidden="true" />}
    </button>
  )
}
