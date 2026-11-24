import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import type { Appearance, Stripe } from '@stripe/stripe-js'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useLanguage } from '../../app/providers/LanguageProvider'
import { Button, CreditCard, ErrorBanner, Input, Lock } from '../../design-system'
import { request } from '../../lib/api-client'
import { shouldMock } from '../../mocks/enable'
import { apiErrorMessage } from '../shared/helpers'
import './PaymentStep.css'

type PaymentStepProps = {
  orderId: number
  clientSecret: string
  /** Already formatted, e.g. "$28.80". */
  total: string
  /** Called once the payment went through (the webhook then confirms it server-side). */
  onPaid: () => void
}

let stripePromise: Promise<Stripe | null> | null = null

/** Stripe.js is loaded lazily, only when someone actually reaches the payment step. */
function getStripe(publishableKey: string) {
  stripePromise ??= loadStripe(publishableKey)
  return stripePromise
}

/** Stripe's Appearance API takes literal colors, so read them from the design tokens. */
function stripeAppearance(): Appearance {
  const style = getComputedStyle(document.documentElement)
  const token = (name: string) => style.getPropertyValue(name).trim()
  return {
    theme: document.documentElement.getAttribute('data-theme') === 'dark' ? 'night' : 'stripe',
    variables: {
      colorPrimary: token('--color-brand-500'),
      colorBackground: token('--color-surface-card'),
      colorText: token('--color-ink-900'),
      colorDanger: token('--color-danger'),
      fontFamily: token('--font-sans'),
      borderRadius: token('--radius-md'),
    },
  }
}

export function PaymentStep(props: PaymentStepProps) {
  const { t } = useTranslation()
  const { language } = useLanguage()
  const publishableKey = String(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? '').trim()

  return (
    <section className="fs-payment" aria-labelledby="pay-title">
      <header>
        <span aria-hidden="true">
          <CreditCard size={20} />
        </span>
        <div>
          <h2 id="pay-title" className="t-h4">
            {t('checkout.payTitle')}
          </h2>
          <p>{t('checkout.payHint', { total: props.total })}</p>
        </div>
      </header>

      {publishableKey ? (
        <Elements
          stripe={getStripe(publishableKey)}
          options={{
            clientSecret: props.clientSecret,
            locale: language,
            appearance: stripeAppearance(),
          }}
        >
          <StripeForm {...props} />
        </Elements>
      ) : shouldMock() ? (
        <DemoCardForm {...props} />
      ) : (
        <ErrorBanner message={t('checkout.paymentUnavailable')} />
      )}
    </section>
  )
}

function StripeForm({ orderId, total, onPaid }: PaymentStepProps) {
  const { t } = useTranslation()
  const stripe = useStripe()
  const elements = useElements()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!stripe || !elements) return
    setBusy(true)
    setMessage(null)

    // 3-D Secure may redirect away; Stripe sends the customer back to the tracking page.
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/orders/${orderId}` },
    })

    if (error) {
      // Card and validation errors carry Stripe's own (localized) message; anything else is generic.
      const friendly = error.type === 'card_error' || error.type === 'validation_error'
      setMessage(friendly && error.message ? error.message : t('errors.default'))
      setBusy(false)
      return
    }
    onPaid()
  }

  return (
    <form className="fs-payment__form" onSubmit={onSubmit}>
      <PaymentElement />
      {message && <ErrorBanner message={message} />}
      <Button type="submit" size="L" icon={Lock} disabled={!stripe || !elements || busy}>
        {busy ? t('checkout.paying') : t('checkout.pay', { total })}
      </Button>
    </form>
  )
}

/** Demo-mode stand-in for the Payment Element (no Stripe account needed). */
function DemoCardForm({ orderId, total, onPaid }: PaymentStepProps) {
  const { t } = useTranslation()
  const [cardNumber, setCardNumber] = useState('4242 4242 4242 4242')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await request(`/_mock/payments/${orderId}/confirm`, { method: 'POST', body: { cardNumber } })
      onPaid()
    } catch (caught) {
      setError(caught)
      setBusy(false)
    }
  }

  return (
    <form className="fs-payment__form" onSubmit={onSubmit}>
      <p className="fs-payment__demo">{t('checkout.demoHint')}</p>
      <Input
        label={t('checkout.cardNumber')}
        icon={CreditCard}
        inputMode="numeric"
        autoComplete="off"
        value={cardNumber}
        onChange={(event) => setCardNumber(event.target.value)}
      />
      <div className="fs-payment__row">
        <Input label={t('checkout.expiry')} defaultValue="12 / 34" autoComplete="off" />
        <Input label={t('checkout.cvc')} defaultValue="123" autoComplete="off" />
      </div>
      {error !== null && <ErrorBanner message={apiErrorMessage(error, t)} />}
      <Button type="submit" size="L" icon={Lock} disabled={busy}>
        {busy ? t('checkout.paying') : t('checkout.pay', { total })}
      </Button>
    </form>
  )
}
