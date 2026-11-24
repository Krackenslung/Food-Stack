import { useMutation } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../app/providers/AuthProvider'
import { useLanguage } from '../../app/providers/LanguageProvider'
import { useTheme } from '../../app/providers/ThemeProvider'
import { Button, ErrorBanner } from '../../design-system'
import { api } from '../../lib/api/endpoints'
import { googleClientId, renderGoogleButton } from '../../lib/google'
import { DEMO_GOOGLE_ACCOUNT, mockCredential } from '../../mocks/credential'
import { shouldMock } from '../../mocks/enable'
import { apiErrorMessage } from '../shared/helpers'
import { HOME_BY_ROLE } from './homeByRole'
import './GoogleSection.css'

type GoogleSectionProps = {
  /** Where to go after signing in, when the visitor was heading somewhere specific. */
  redirectTo?: string
  text: 'signin_with' | 'signup_with'
}

/**
 * "Continue with Google" plus the "or with email" divider. Renders nothing when Google sign-in
 * is not configured (no VITE_GOOGLE_CLIENT_ID and not in demo mode).
 */
export function GoogleSection({ redirectTo, text }: GoogleSectionProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { refresh } = useAuth()
  const clientId = googleClientId()
  const demo = !clientId && shouldMock()

  const signIn = useMutation({
    mutationFn: api.googleLogin,
    onSuccess: async () => {
      const user = await refresh()
      navigate(redirectTo ?? HOME_BY_ROLE[user?.role ?? 'customer'], { replace: true })
    },
  })

  if (!clientId && !demo) return null

  return (
    <div className="fs-google">
      {signIn.isError && <ErrorBanner message={apiErrorMessage(signIn.error, t)} />}
      {clientId ? (
        <OfficialButton
          clientId={clientId}
          text={text}
          onCredential={(token) => signIn.mutate(token)}
        />
      ) : (
        <Button
          variant="secondary"
          size="L"
          disabled={signIn.isPending}
          onClick={() => signIn.mutate(mockCredential(DEMO_GOOGLE_ACCOUNT))}
        >
          {t('auth.continueWithGoogleDemo')}
        </Button>
      )}
      <div className="fs-google__divider" role="separator">
        <span>{t('auth.orWithEmail')}</span>
      </div>
    </div>
  )
}

/** Google's own button (their branding rules), drawn by GIS into a div. */
function OfficialButton({
  clientId,
  text,
  onCredential,
}: {
  clientId: string
  text: 'signin_with' | 'signup_with'
  onCredential: (idToken: string) => void
}) {
  const { language } = useLanguage()
  const { resolved } = useTheme()
  const container = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)
  const callback = useRef(onCredential)
  callback.current = onCredential

  useEffect(() => {
    const element = container.current
    if (!element) return
    element.replaceChildren()
    renderGoogleButton(element, {
      clientId,
      text,
      locale: language,
      dark: resolved === 'dark',
      width: Math.min(400, element.clientWidth || 400),
      onCredential: (token) => callback.current(token),
    }).catch(() => setFailed(true))
  }, [clientId, text, language, resolved])

  if (failed) return null
  return <div ref={container} className="fs-google__official" />
}
