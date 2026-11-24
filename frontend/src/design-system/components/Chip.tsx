import type { ButtonHTMLAttributes } from 'react'
import './Chip.css'

type ChipProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-pressed'> & {
  active?: boolean
}

export function Chip({ active = false, className, children, type = 'button', ...rest }: ChipProps) {
  return (
    <button
      type={type}
      aria-pressed={active}
      className={['fs-chip', active && 'fs-chip--active', className].filter(Boolean).join(' ')}
      {...rest}
    >
      {children}
    </button>
  )
}
