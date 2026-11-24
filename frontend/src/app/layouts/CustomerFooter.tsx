import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Logo } from '../../design-system'
import './CustomerFooter.css'

/** Footer with only links that exist today (Deals, Locations, Careers… have no pages yet). */
export function CustomerFooter() {
  const { t } = useTranslation()

  return (
    <footer className="fs-footer">
      <div className="fs-footer__top">
        <div className="fs-footer__brand">
          <Logo />
          <p>{t('footer.tagline')}</p>
        </div>
        <nav aria-label={t('footer.order')}>
          <h2 className="t-label-m">{t('footer.order')}</h2>
          <Link to="/menu">{t('nav.menu')}</Link>
          <Link to="/account/orders">{t('nav.trackOrder')}</Link>
        </nav>
        <nav aria-label={t('footer.account')}>
          <h2 className="t-label-m">{t('footer.account')}</h2>
          <Link to="/login">{t('nav.login')}</Link>
          <Link to="/signup">{t('pages.signup')}</Link>
        </nav>
      </div>
      <p className="fs-footer__legal t-label-s">
        {t('footer.rights', { year: new Date().getFullYear() })}
      </p>
    </footer>
  )
}
