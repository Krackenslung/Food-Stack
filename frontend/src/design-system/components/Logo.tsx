import burger from '../assets/burger.svg'
import './Logo.css'

type LogoProps = {
  /** Use on dark surfaces (the "Food" half turns white). */
  onDark?: boolean
  className?: string
}

export function Logo({ onDark = false, className }: LogoProps) {
  return (
    <span
      className={['fs-logo', onDark && 'fs-logo--on-dark', className].filter(Boolean).join(' ')}
    >
      <span className="fs-logo__mark">
        <img src={burger} width={22} height={22} alt="" />
      </span>
      <span className="fs-logo__word">
        Food<span className="fs-logo__accent">Stack</span>
      </span>
    </span>
  )
}
