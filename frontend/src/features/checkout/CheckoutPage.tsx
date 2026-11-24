import { useMutation } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../../app/providers/AuthProvider'
import {
  ArrowRight,
  Button,
  Check,
  ChevronLeft,
  Chip,
  Clock,
  CreditCard,
  ErrorBanner,
  Home,
  Input,
  Lock,
  Logo,
  Mail,
  MapPin,
  Phone,
  RadioCard,
  Shield,
  Truck,
  User,
} from '../../design-system'
import { api } from '../../lib/api/endpoints'
import type { FulfillmentType } from '../../lib/api/types'
import { CartSummary } from '../cart/CartSummary'
import { toLineInputs, useCartStore } from '../cart/cartStore'
import { apiErrorMessage, describeChanges, formatHour } from '../shared/helpers'
import { useMoney, useQuote, useStoreInfo } from '../shared/queries'
import { earliestSchedule, validateSchedule } from './schedule'
import './CheckoutPage.css'

type FieldErrors = Partial<Record<'name' | 'phone' | 'email' | 'address' | 'schedule', string>>

const EMAIL = /^\S+@\S+\.\S+$/

export function CheckoutPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const money = useMoney()
  const { user } = useAuth()
  const { data: store } = useStoreInfo()
  const items = useCartStore((s) => s.items)
  const promoCode = useCartStore((s) => s.promoCode)
  const fulfillmentType = useCartStore((s) => s.fulfillmentType)
  const setFulfillmentType = useCartStore((s) => s.setFulfillmentType)
  const clearCart = useCartStore((s) => s.clear)
  const { data: quote } = useQuote({ items, promoCode, fulfillmentType })

  const [name, setName] = useState(user ? `${user.name} ${user.lastname}`.trim() : '')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState(user?.email ?? '')
  const [address, setAddress] = useState('')
  const [asap, setAsap] = useState(true)
  const [scheduledFor, setScheduledFor] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})

  // Set before the cart is cleared so the empty-cart guard below doesn't hijack the redirect.
  const placed = useRef(false)

  const placeOrder = useMutation({
    mutationFn: api.checkout,
    onSuccess: (result) => {
      placed.current = true
      navigate(`/orders/${result.orderId}`, { replace: true })
      clearCart()
    },
  })

  // Nothing to pay for: send people back to the cart (unless we just placed the order).
  if (items.length === 0 && !placed.current) return <Navigate to="/cart" replace />

  const closed = store ? !store.isOpen : false

  function validate(): FieldErrors {
    const next: FieldErrors = {}
    if (!name.trim()) next.name = t('checkout.errors.name')
    if (!phone.trim()) next.phone = t('checkout.errors.phone')
    if (!EMAIL.test(email.trim())) next.email = t('checkout.errors.email')
    if (fulfillmentType === 'delivery' && !address.trim())
      next.address = t('checkout.errors.address')
    if (!asap && store) {
      const problem = validateSchedule(scheduledFor, new Date(), store.opensAt, store.closesAt)
      if (problem) next.schedule = t(`checkout.errors.${problem}`)
    }
    return next
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (placeOrder.isPending || closed) return
    const found = validate()
    setErrors(found)
    if (Object.keys(found).length > 0) return

    placeOrder.mutate({
      items: toLineInputs(items),
      promoCode: promoCode.trim() || undefined,
      fulfillmentType,
      contact: { name: name.trim(), phone: phone.trim(), email: email.trim() },
      deliveryAddress: fulfillmentType === 'delivery' ? address.trim() : undefined,
      scheduledFor: asap ? undefined : new Date(scheduledFor).toISOString(),
      // Card payments arrive in Phase 4; until then every order is paid at the counter.
      paymentMethod: 'counter',
    })
  }

  return (
    <div className="fs-checkout">
      <header className="fs-checkout__bar">
        <Link to="/cart" className="fs-checkout__back">
          <ChevronLeft size={18} aria-hidden="true" />
          {t('checkout.back')}
        </Link>
        <Link to="/" aria-label="FoodStack">
          <Logo />
        </Link>
        <span className="fs-checkout__secure">
          <Lock size={16} aria-hidden="true" />
          {t('checkout.secure')}
        </span>
      </header>

      <ol className="fs-checkout__steps" aria-label={t('checkout.steps')}>
        <li className="fs-checkout__step fs-checkout__step--done">
          <span>
            <Check size={16} aria-hidden="true" />
          </span>
          {t('checkout.stepCart')}
        </li>
        <li className="fs-checkout__step fs-checkout__step--current" aria-current="step">
          <span>2</span>
          {t('checkout.stepDetails')}
        </li>
        <li className="fs-checkout__step">
          <span>3</span>
          {t('checkout.stepConfirm')}
        </li>
      </ol>

      <form className="fs-checkout__layout" onSubmit={onSubmit} noValidate>
        <div className="fs-checkout__forms">
          {closed && store && (
            <ErrorBanner message={t('checkout.closed', { time: formatHour(store.opensAt) })} />
          )}
          {placeOrder.isError && <ErrorBanner message={apiErrorMessage(placeOrder.error, t)} />}

          <section className="fs-checkout__card" aria-labelledby="contact-title">
            <CardHeading
              index={1}
              id="contact-title"
              title={t('checkout.contact')}
              hint={t('checkout.contactHint')}
            />
            <div className="fs-checkout__row">
              <Input
                label={t('checkout.name')}
                icon={User}
                value={name}
                autoComplete="name"
                error={errors.name}
                onChange={(event) => setName(event.target.value)}
              />
              <Input
                label={t('checkout.phone')}
                icon={Phone}
                value={phone}
                type="tel"
                autoComplete="tel"
                error={errors.phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </div>
            <Input
              label={t('checkout.email')}
              icon={Mail}
              value={email}
              type="email"
              autoComplete="email"
              error={errors.email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </section>

          <section className="fs-checkout__card" aria-labelledby="fulfillment-title">
            <CardHeading
              index={2}
              id="fulfillment-title"
              title={t('checkout.fulfillment')}
              hint={t('checkout.fulfillmentHint')}
            />
            <div className="fs-checkout__row">
              {(['pickup', 'delivery'] as FulfillmentType[]).map((type) => (
                <RadioCard
                  key={type}
                  name="fulfillment"
                  checked={fulfillmentType === type}
                  onChange={() => setFulfillmentType(type)}
                  icon={type === 'pickup' ? Home : Truck}
                  title={t(`cart.${type}`)}
                  description={t(`checkout.${type}Desc`, { minutes: store?.waitMinutes ?? 15 })}
                />
              ))}
            </div>

            {fulfillmentType === 'pickup' && store && (
              <div className="fs-checkout__store">
                <MapPin size={18} aria-hidden="true" />
                <div>
                  <strong>{store.name}</strong>
                  <span>{store.address}</span>
                </div>
              </div>
            )}
            {fulfillmentType === 'delivery' && (
              <Input
                label={t('checkout.address')}
                icon={MapPin}
                value={address}
                autoComplete="street-address"
                error={errors.address}
                onChange={(event) => setAddress(event.target.value)}
              />
            )}

            <div className="fs-checkout__when">
              <Chip active={asap} onClick={() => setAsap(true)}>
                <Clock size={16} aria-hidden="true" />
                {t('checkout.asap')}
              </Chip>
              <Chip active={!asap} onClick={() => setAsap(false)}>
                {t('checkout.later')}
              </Chip>
            </div>
            {!asap && (
              <Input
                label={t('checkout.scheduleAt')}
                type="datetime-local"
                value={scheduledFor}
                min={earliestSchedule(new Date())}
                error={errors.schedule}
                helper={
                  store
                    ? t('checkout.scheduleHint', {
                        opens: formatHour(store.opensAt),
                        closes: formatHour(store.closesAt),
                      })
                    : undefined
                }
                onChange={(event) => setScheduledFor(event.target.value)}
              />
            )}
          </section>

          <section className="fs-checkout__card" aria-labelledby="payment-title">
            <CardHeading
              index={3}
              id="payment-title"
              title={t('checkout.payment')}
              hint={t('checkout.paymentHint')}
            />
            <div className="fs-checkout__row">
              <RadioCard
                name="payment"
                checked={false}
                onChange={() => {}}
                disabled
                icon={CreditCard}
                title={t('checkout.card')}
                tag={t('common.comingSoon')}
              />
              <RadioCard
                name="payment"
                checked
                onChange={() => {}}
                icon={Shield}
                title={t('checkout.counter')}
                description={t('checkout.counterDesc')}
              />
            </div>
          </section>
        </div>

        <aside className="fs-checkout__summary" aria-label={t('cart.summaryTitle')}>
          <h2 className="t-h3">{t('cart.summaryTitle')}</h2>
          <ul className="fs-checkout__items">
            {items.map((item, index) => {
              const changes = describeChanges(item.ingredients, t)
              return (
                <li key={item.key}>
                  <img src={item.image} alt="" />
                  <span>
                    <strong>
                      {item.quantity}× {item.name}
                    </strong>
                    {changes.length > 0 && <span>{changes.join(' · ')}</span>}
                  </span>
                  <span>{quote?.lines[index] ? money(quote.lines[index].lineTotal) : '—'}</span>
                </li>
              )
            })}
          </ul>
          {quote?.promo?.valid && (
            <p className="fs-checkout__promo" role="status">
              <Check size={16} aria-hidden="true" />
              {t('cart.promoApplied', { code: quote.promo.code })}
              <span>−{money(quote.discount)}</span>
            </p>
          )}
          <CartSummary quote={quote} />
          <Button
            type="submit"
            size="L"
            icon={ArrowRight}
            className="fs-checkout__cta"
            disabled={!quote || closed || placeOrder.isPending}
          >
            {placeOrder.isPending
              ? t('checkout.placing')
              : quote
                ? t('checkout.placeOrder', { total: money(quote.total) })
                : t('common.loading')}
          </Button>
          <p className="fs-checkout__terms">{t('checkout.terms')}</p>
        </aside>
      </form>
    </div>
  )
}

function CardHeading({
  index,
  id,
  title,
  hint,
}: {
  index: number
  id: string
  title: string
  hint: string
}) {
  return (
    <div className="fs-checkout__heading">
      <span aria-hidden="true">{index}</span>
      <div>
        <h2 id={id} className="t-h4">
          {title}
        </h2>
        <p>{hint}</p>
      </div>
    </div>
  )
}
