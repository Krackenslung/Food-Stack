import { useTranslation } from 'react-i18next'

/** Stand-in for screens built in Phases 3 and 6. The title comes from locales (pages.*). */
export function ScreenPlaceholder({ titleKey }: { titleKey: string }) {
  const { t } = useTranslation()

  return (
    <section>
      <h1 className="t-h1">{t(titleKey)}</h1>
      <p className="t-body-m">{t('pages.placeholder')}</p>
    </section>
  )
}
