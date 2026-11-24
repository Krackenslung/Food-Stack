import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

export function NotFound() {
  const { t } = useTranslation()

  return (
    <section style={{ padding: 'var(--space-32)' }}>
      <h1 className="t-h1">{t('pages.notFound')}</h1>
      <p>
        <Link to="/">{t('common.backHome')}</Link>
      </p>
    </section>
  )
}
