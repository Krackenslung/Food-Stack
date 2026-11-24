import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { useLanguage } from '../../app/providers/LanguageProvider'
import {
  Badge,
  Button,
  Check,
  ErrorBanner,
  MapPin,
  Package,
  Skeleton,
  Utensils,
  X,
} from '../../design-system'
import type { LucideIcon } from '../../design-system'
import { api } from '../../lib/api/endpoints'
import type { OrderDetail, OrderStatus } from '../../lib/api/types'
import { formatDateTime } from '../../lib/format'
import { useCartStore } from '../cart/cartStore'
import { clearPendingOrder, readPendingOrder } from '../checkout/pendingOrder'
import { apiErrorMessage } from '../shared/helpers'
import { useMoney, useStoreInfo } from '../shared/queries'
import { StatusBadge } from '../shared/StatusBadge'
import './OrderTrackingPage.css'

const STEPS: { status: OrderStatus; icon: LucideIcon }[] = [
  { status: 'received', icon: Check },
  { status: 'preparing', icon: Utensils },
  { status: 'ready', icon: Package },
  { status: 'completed', icon: Check },
]

const POLL_MS = 10_000

export function OrderTrackingPage() {
  const { t } = useTranslation()
  const { language } = useLanguage()
  const { id } = useParams()
  const orderId = Number(id)

  const {
    data: order,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['order', orderId, language],
    queryFn: () => api.order(orderId, language),
    enabled: Number.isFinite(orderId),
    // Live status: poll every 10 s while the order is still moving.
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === 'completed' || status === 'cancelled' ? false : POLL_MS
    },
  })

  // A card order empties the cart only once payment is confirmed (see checkout/pendingOrder).
  const clearCart = useCartStore((state) => state.clear)
  useEffect(() => {
    if (!order || readPendingOrder() !== order.id) return
    if (order.paymentStatus === 'paid') clearCart()
    if (order.paymentStatus === 'paid' || order.status === 'cancelled') clearPendingOrder()
  }, [order, clearCart])

  if (isError) {
    return (
      <div className="fs-page">
        <ErrorBanner
          message={apiErrorMessage(error, t)}
          retryLabel={t('common.retry')}
          onRetry={() => void refetch()}
        />
      </div>
    )
  }

  if (!order) {
    return (
      <div className="fs-page" aria-busy="true">
        <Skeleton style={{ height: 334, borderRadius: 28 }} />
      </div>
    )
  }

  return (
    <div className="fs-page fs-tracking">
      <Hero order={order} language={language} />
      <div className="fs-tracking__grid">
        <Details order={order} />
        <aside className="fs-tracking__side">
          <PickupCard order={order} />
          <CancelBlock order={order} />
        </aside>
      </div>
    </div>
  )
}

function Hero({ order, language }: { order: OrderDetail; language: 'en' | 'es' }) {
  const { t } = useTranslation()
  const cancelled = order.status === 'cancelled'
  const stepIndex = STEPS.findIndex((step) => step.status === order.status)
  const timeOf = (status: OrderStatus) => {
    const entry = order.history.find((h) => h.toStatus === status)
    return entry
      ? new Date(entry.createdAt).toLocaleTimeString(language === 'es' ? 'es-MX' : 'en-US', {
          hour: 'numeric',
          minute: '2-digit',
        })
      : null
  }

  return (
    <section className="fs-tracking__hero" aria-live="polite">
      <div className="fs-tracking__hero-top">
        <div>
          <p className="fs-tracking__meta">
            <StatusBadge status={order.status} />
            <span>
              {t('tracking.orderNumber', { number: order.orderNumber })} ·{' '}
              {t('tracking.placed', { time: formatDateTime(order.createdAt, language) })}
            </span>
          </p>
          <h1 className="t-h1">{t(`tracking.title.${order.status}`)}</h1>
          <p className="t-body-l">{t(`tracking.subtitle.${order.status}`)}</p>
        </div>
        {order.eta && (
          <div className="fs-tracking__eta">
            <span className="t-overline">{t('tracking.readyIn')}</span>
            <strong>{t('tracking.minutes', { count: order.eta.minutes })}</strong>
            <span>
              {t('tracking.approx', {
                time: new Date(order.eta.readyAt).toLocaleTimeString(
                  language === 'es' ? 'es-MX' : 'en-US',
                  { hour: 'numeric', minute: '2-digit' },
                ),
              })}
            </span>
          </div>
        )}
      </div>

      {cancelled ? null : (
        <ol className="fs-tracking__timeline" aria-label={t('tracking.timeline')}>
          {STEPS.map(({ status, icon: Icon }, index) => {
            const state = index < stepIndex ? 'done' : index === stepIndex ? 'current' : 'todo'
            const time = timeOf(status)
            return (
              <li key={status} className={`fs-tracking__step fs-tracking__step--${state}`}>
                <span className="fs-tracking__dot">
                  <Icon size={20} aria-hidden="true" />
                </span>
                <span className="fs-tracking__step-label">
                  {t(`tracking.steps.${order.fulfillmentType}.${status}`)}
                  <small>{time ?? '—'}</small>
                </span>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

function Details({ order }: { order: OrderDetail }) {
  const { t } = useTranslation()
  const money = useMoney()
  const feesAndTax = Number(order.serviceFee) + Number(order.deliveryFee) + Number(order.tax)
  const paid = order.paymentStatus === 'paid'

  return (
    <section className="fs-tracking__card" aria-labelledby="order-details">
      <div className="fs-tracking__card-head">
        <h2 id="order-details" className="t-h3">
          {t('tracking.details')}
        </h2>
        <Badge tone={paid ? 'success' : 'info'}>
          {t(`tracking.payment.${order.paymentStatus}`)}
        </Badge>
      </div>
      <ul className="fs-tracking__lines">
        {order.lines.map((line) => {
          const changes = line.ingredients
            .filter((ingredient) => ingredient.quantity !== ingredient.default)
            .map((ingredient) =>
              ingredient.quantity === 0
                ? t('cart.changes.no', { name: ingredient.name })
                : ingredient.quantity > ingredient.default && ingredient.default > 0
                  ? t('cart.changes.extra', { name: ingredient.name })
                  : t('cart.changes.add', { name: ingredient.name }),
            )
          return (
            <li key={line.id}>
              <img src={line.image} alt="" />
              <span>
                <strong>
                  {line.quantity}× {line.name}
                </strong>
                {changes.length > 0 && <span>{changes.join(' · ')}</span>}
              </span>
              <span>{money(line.lineTotal)}</span>
            </li>
          )
        })}
      </ul>
      <dl className="fs-tracking__rows">
        <div>
          <dt>{t('summary.subtotal')}</dt>
          <dd>{money(order.subtotal)}</dd>
        </div>
        {Number(order.discount) > 0 && (
          <div className="fs-tracking__discount">
            <dt>
              {t('summary.discount')}
              {order.promoCode && ` (${order.promoCode})`}
            </dt>
            <dd>−{money(order.discount)}</dd>
          </div>
        )}
        <div>
          <dt>{t('tracking.feesAndTax')}</dt>
          <dd>{money(feesAndTax)}</dd>
        </div>
      </dl>
      <div className="fs-tracking__total">
        <span>{paid ? t('tracking.totalPaid') : t('summary.total')}</span>
        <span>{money(order.total)}</span>
      </div>
    </section>
  )
}

function PickupCard({ order }: { order: OrderDetail }) {
  const { t } = useTranslation()
  const { data: store } = useStoreInfo()
  const delivery = order.fulfillmentType === 'delivery'
  const address = delivery ? order.deliveryAddress : store?.address

  return (
    <section className="fs-tracking__card fs-tracking__pickup" aria-labelledby="pickup-title">
      <div className="fs-tracking__map" aria-hidden="true">
        <span>
          <MapPin size={22} />
        </span>
      </div>
      <div className="fs-tracking__pickup-body">
        <p className="t-overline">
          {t(delivery ? 'tracking.deliveryTo' : 'tracking.pickupLocation')}
        </p>
        <h2 id="pickup-title" className="t-h3">
          {delivery ? order.contact.name : (store?.name ?? '…')}
        </h2>
        <p>{address}</p>
        {address && (
          <a
            className="fs-tracking__directions"
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('tracking.directions')}
          </a>
        )}
      </div>
    </section>
  )
}

function CancelBlock({ order }: { order: OrderDetail }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [confirming, setConfirming] = useState(false)

  const cancel = useMutation({
    mutationFn: () => api.cancelOrder(order.id),
    onSuccess: () => {
      setConfirming(false)
      void queryClient.invalidateQueries({ queryKey: ['order', order.id] })
      void queryClient.invalidateQueries({ queryKey: ['my-orders'] })
    },
  })

  if (order.status !== 'received') {
    return (
      <p className="fs-tracking__note">
        <Link to="/menu">{t('tracking.orderAgain')}</Link>
      </p>
    )
  }

  return (
    <div className="fs-tracking__cancel">
      {cancel.isError && <ErrorBanner message={apiErrorMessage(cancel.error, t)} />}
      {confirming ? (
        <div className="fs-tracking__confirm" role="group" aria-label={t('tracking.cancelConfirm')}>
          <p>{t('tracking.cancelConfirm')}</p>
          <div>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              {t('tracking.keepOrder')}
            </Button>
            <Button variant="dark" disabled={cancel.isPending} onClick={() => cancel.mutate()}>
              {t('tracking.confirmCancel')}
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="fs-tracking__cancel-link"
          onClick={() => setConfirming(true)}
        >
          <X size={14} aria-hidden="true" />
          {t('tracking.cancelHint')}
        </button>
      )}
    </div>
  )
}
