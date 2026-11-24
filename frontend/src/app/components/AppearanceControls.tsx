import { useTranslation } from 'react-i18next'
import { LANGUAGES } from '../../lib/language'
import type { ThemePreference } from '../../lib/theme'
import { useLanguage } from '../providers/LanguageProvider'
import { useTheme } from '../providers/ThemeProvider'
import './AppearanceControls.css'

const THEMES: ThemePreference[] = ['light', 'dark', 'system']

/** Language and theme toggles shared by CustomerNav, the mobile Profile tab and the admin topbar. */
export function AppearanceControls() {
  const { t } = useTranslation()
  const { language, setLanguage } = useLanguage()
  const { preference, setPreference } = useTheme()

  return (
    <div className="fs-appearance">
      <div className="fs-appearance__group" role="group" aria-label={t('language.label')}>
        {LANGUAGES.map((code) => (
          <button
            key={code}
            type="button"
            className="fs-appearance__btn"
            aria-pressed={language === code}
            aria-label={`${code.toUpperCase()}, ${t(`language.${code}`)}`}
            onClick={() => setLanguage(code)}
          >
            {code.toUpperCase()}
          </button>
        ))}
      </div>
      <div className="fs-appearance__group" role="group" aria-label={t('theme.label')}>
        {THEMES.map((mode) => (
          <button
            key={mode}
            type="button"
            className="fs-appearance__btn"
            aria-pressed={preference === mode}
            onClick={() => setPreference(mode)}
          >
            {t(`theme.${mode}`)}
          </button>
        ))}
      </div>
    </div>
  )
}
