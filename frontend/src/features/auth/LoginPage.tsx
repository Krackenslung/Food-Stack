import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../app/providers/AuthProvider'
import { ArrowRight, Button, ErrorBanner, Input, Lock, Mail, Shield } from '../../design-system'
import { api } from '../../lib/api/endpoints'
import { apiErrorMessage } from '../shared/helpers'
import { AuthLayout } from './AuthLayout'
import { GoogleSection } from './GoogleSection'
import { HOME_BY_ROLE } from './homeByRole'
import './AuthForms.css'

export function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, refresh } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})
  const from = (location.state as { from?: string } | null)?.from

  const login = useMutation({
    mutationFn: api.login,
    onSuccess: async () => {
      const signedIn = await refresh()
      navigate(from ?? HOME_BY_ROLE[signedIn?.role ?? 'customer'], { replace: true })
    },
  })

  if (user && !login.isPending && !login.isSuccess) {
    return <Navigate to={from ?? HOME_BY_ROLE[user.role]} replace />
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    const next: typeof errors = {}
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) next.email = t('checkout.errors.email')
    if (!password) next.password = t('auth.errors.password')
    setErrors(next)
    if (Object.keys(next).length > 0) return
    login.mutate({ email: email.trim(), password })
  }

  return (
    <AuthLayout
      headline={t('auth.loginHeadline')}
      tagline={t('auth.loginTagline')}
      title={t('auth.welcomeBack')}
      subtitle={t('auth.loginSubtitle')}
    >
      <GoogleSection text="signin_with" redirectTo={from} />
      <form className="fs-auth-form" onSubmit={onSubmit} noValidate>
        {login.isError && <ErrorBanner message={apiErrorMessage(login.error, t)} />}
        <Input
          label={t('checkout.email')}
          icon={Mail}
          type="email"
          autoComplete="email"
          value={email}
          error={errors.email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <Input
          label={t('auth.password')}
          icon={Lock}
          type="password"
          autoComplete="current-password"
          value={password}
          error={errors.password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <Button type="submit" size="L" icon={ArrowRight} disabled={login.isPending}>
          {login.isPending ? t('auth.signingIn') : t('auth.signIn')}
        </Button>
        <p className="fs-auth-form__switch">
          {t('auth.noAccount')} <Link to="/signup">{t('auth.signUpFree')}</Link>
        </p>
        <p className="fs-auth-form__note">
          <Shield size={16} aria-hidden="true" />
          {t('auth.staffNote')}
        </p>
      </form>
    </AuthLayout>
  )
}
