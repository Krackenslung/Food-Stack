import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../../app/providers/AuthProvider'
import {
  ArrowRight,
  Button,
  Checkbox,
  ErrorBanner,
  Input,
  Lock,
  Mail,
  Phone,
  User,
} from '../../design-system'
import { api } from '../../lib/api/endpoints'
import { apiErrorMessage, passwordStrength } from '../shared/helpers'
import { AuthLayout } from './AuthLayout'
import { HOME_BY_ROLE } from './LoginPage'
import './AuthForms.css'

type Errors = Partial<
  Record<'name' | 'lastname' | 'email' | 'phone' | 'password' | 'terms', string>
>

export function SignupPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, refresh } = useAuth()
  const [form, setForm] = useState({
    name: '',
    lastname: '',
    email: '',
    phone: '',
    password: '',
    terms: false,
  })
  const [errors, setErrors] = useState<Errors>({})
  const strength = passwordStrength(form.password)

  const signup = useMutation({
    mutationFn: api.signup,
    onSuccess: async () => {
      const signedIn = await refresh()
      navigate(HOME_BY_ROLE[signedIn?.role ?? 'customer'], { replace: true })
    },
  })

  if (user && !signup.isPending && !signup.isSuccess) {
    return <Navigate to={HOME_BY_ROLE[user.role]} replace />
  }

  const set = (field: keyof typeof form) => (value: string | boolean) =>
    setForm((current) => ({ ...current, [field]: value }))

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    const next: Errors = {}
    if (!form.name.trim()) next.name = t('auth.errors.name')
    if (!form.lastname.trim()) next.lastname = t('auth.errors.lastname')
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) next.email = t('checkout.errors.email')
    if (!form.phone.trim()) next.phone = t('checkout.errors.phone')
    if (form.password.length < 8) next.password = t('auth.errors.passwordShort')
    if (!form.terms) next.terms = t('auth.errors.terms')
    setErrors(next)
    if (Object.keys(next).length > 0) return

    // The server forces role "customer" on public signup; no role is sent.
    signup.mutate({
      name: form.name.trim(),
      lastname: form.lastname.trim(),
      email: form.email.trim(),
      phoneNumber: form.phone.trim(),
      password: form.password,
    })
  }

  return (
    <AuthLayout
      headline={t('auth.signupHeadline')}
      tagline={t('auth.signupTagline')}
      title={t('auth.createAccount')}
      subtitle={t('auth.signupSubtitle')}
    >
      <form className="fs-auth-form" onSubmit={onSubmit} noValidate>
        {signup.isError && <ErrorBanner message={apiErrorMessage(signup.error, t)} />}
        <div className="fs-auth-form__row">
          <Input
            label={t('auth.firstName')}
            icon={User}
            autoComplete="given-name"
            value={form.name}
            error={errors.name}
            onChange={(event) => set('name')(event.target.value)}
          />
          <Input
            label={t('auth.lastName')}
            icon={User}
            autoComplete="family-name"
            value={form.lastname}
            error={errors.lastname}
            onChange={(event) => set('lastname')(event.target.value)}
          />
        </div>
        <Input
          label={t('checkout.email')}
          icon={Mail}
          type="email"
          autoComplete="email"
          value={form.email}
          error={errors.email}
          onChange={(event) => set('email')(event.target.value)}
        />
        <Input
          label={t('auth.phone')}
          icon={Phone}
          type="tel"
          autoComplete="tel"
          value={form.phone}
          error={errors.phone}
          onChange={(event) => set('phone')(event.target.value)}
        />
        <div>
          <Input
            label={t('auth.password')}
            icon={Lock}
            type="password"
            autoComplete="new-password"
            value={form.password}
            error={errors.password}
            onChange={(event) => set('password')(event.target.value)}
          />
          {form.password && (
            <div className="fs-strength" data-level={strength}>
              <div className="fs-strength__bars" aria-hidden="true">
                {[1, 2, 3, 4].map((n) => (
                  <span key={n} data-on={n <= strength} />
                ))}
              </div>
              <p>
                {t(`auth.strength.${strength}`)} · {t('auth.strengthHint')}
              </p>
            </div>
          )}
        </div>
        <Checkbox
          checked={form.terms}
          onChange={(event) => set('terms')(event.target.checked)}
          aria-invalid={errors.terms ? true : undefined}
        >
          <span className="fs-auth-form__terms">{t('auth.terms')}</span>
        </Checkbox>
        {errors.terms && (
          <p className="fs-auth-form__error" role="alert">
            {errors.terms}
          </p>
        )}
        <Button type="submit" size="L" icon={ArrowRight} disabled={signup.isPending}>
          {signup.isPending ? t('auth.creating') : t('auth.createAccountCta')}
        </Button>
        <p className="fs-auth-form__switch">
          {t('auth.haveAccount')} <Link to="/login">{t('auth.signInLink')}</Link>
        </p>
      </form>
    </AuthLayout>
  )
}
