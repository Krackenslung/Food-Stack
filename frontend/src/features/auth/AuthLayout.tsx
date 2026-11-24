import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Logo } from '../../design-system'
import { AppearanceControls } from '../../app/components/AppearanceControls'
import './AuthLayout.css'

type AuthLayoutProps = {
  headline: string
  tagline: string
  title: string
  subtitle: string
  children: ReactNode
}

/** Split screen shared by Login and Sign up (Figma 08/09): photo collage left, form right. */
export function AuthLayout({ headline, tagline, title, subtitle, children }: AuthLayoutProps) {
  const { t } = useTranslation()

  return (
    <div className="fs-auth">
      <aside className="fs-auth__visual" aria-hidden="true">
        <div className="fs-auth__collage">
          <img
            src="/menu/overkill-double.jpg"
            alt=""
            className="fs-auth__photo fs-auth__photo--a"
          />
          <img
            src="/menu/classic-milkshake.jpg"
            alt=""
            className="fs-auth__photo fs-auth__photo--b"
          />
          <img
            src="/menu/chicken-burrito.jpg"
            alt=""
            className="fs-auth__photo fs-auth__photo--c"
          />
        </div>
        <div className="fs-auth__copy">
          <Logo onDark />
          <h2 className="t-display-l">{headline}</h2>
          <p className="t-body-l">{tagline}</p>
        </div>
      </aside>

      <main className="fs-auth__panel">
        <div className="fs-auth__topbar">
          <Link to="/" className="fs-auth__home" aria-label={t('common.backHome')}>
            <Logo />
          </Link>
          <AppearanceControls />
        </div>
        <div className="fs-auth__form">
          <h1 className="t-h1">{title}</h1>
          <p className="t-body-m fs-auth__subtitle">{subtitle}</p>
          {children}
        </div>
      </main>
    </div>
  )
}
