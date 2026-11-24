import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLanguage } from '../../app/providers/LanguageProvider'
import { useToast } from '../../app/providers/ToastProvider'
import {
  Button,
  Check,
  CreditCard,
  ErrorBanner,
  Mail,
  Modal,
  Phone,
  Receipt,
  Skeleton,
  Utensils,
  X,
} from '../../design-system'
import { api } from '../../lib/api/endpoints'
import type { OrderDetail, OrderStatus } from '../../lib/api/types'
import { formatDateTime } from '../../lib/format'
import { apiErrorMessage, describeChanges } from '../shared/helpers'
import { useMoney } from '../shared/queries'
import { StatusBadge } from '../shared/StatusBadge'
import '../kitchen/KitchenPage.css'
import './admin.css'
import './OrderDrawer.css'

const NEXT: Partial<Record<OrderStatus, { to: OrderStatus; label: string }>> = {
  received: { to: 'preparing', label: 'adminOrders.actions.accept' },
  preparing: { to: 'ready', label: 'adminOrders.actions.markReady' },
  ready: { to: 'completed', label: 'adminOrders.actions.complete' },
}

/** Order detail drawer (Figma A5): items, totals, activity and the actions staff can take. */
export function OrderDrawer({ orderId, onClose }: { orderId: number; onClose: () => void }) {
  const { t } = useTranslation()
  const { language } = useLanguage()
  const {
    data: order,
    isError,
    error,
  } = useQuery({
    queryKey: ['order', orderId, language],
    queryFn: () => api.order(orderId, language),
    refetchInterval: 10_000,
  })

  return (
    <Modal variant="drawer" label={t('adminOrders.drawer')} onClose={onClose}>
      <div className="fs-drawer">
        {isError ? (
          <ErrorBanner message={apiErrorMessage(error, t)} />
        ) : !order ? (
          <Skeleton style={{ height: 320 }} />
        ) : (
          <DrawerBody order={order} onClose={onClose} language={language} />
        )}
      </div>
    </Modal>
  )
}

function DrawerBody({
  order,
  onClose,
  language,
}: {
  order: OrderDetail
  onClose: () => void
  language: 'en' | 'es'
}) {
  const { t } = useTranslation()
  const money = useMoney()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [confirming, setConfirming] = useState<'reject' | 'refund' | null>(null)

  const refresh = () => {
    for (const key of ['order', 'admin-orders', 'kitchen', 'dashboard']) {
      void queryClient.invalidateQueries({ queryKey: [key] })
    }
  }
  const onError = (failure: unknown) => toast.show(apiErrorMessage(failure, t))

  const move = useMutation({
    mutationFn: (status: OrderStatus) => api.setOrderStatus(order.id, status),
    onSuccess: () => {
      setConfirming(null)
      refresh()
    },
    onError,
  })
  const refund = useMutation({
    mutationFn: () => api.refundOrder(order.id),
    onSuccess: () => {
      setConfirming(null)
      toast.show(t('adminOrders.refunded'))
      refresh()
    },
    onError,
  })

  const next = NEXT[order.status]
  const canReject = order.status === 'received' || order.status === 'pending_payment'
  const canRefund = order.paymentMethod === 'card' && order.paymentStatus === 'paid'
  const time = (iso: string) =>
    new Date(iso).toLocaleTimeString(language === 'es' ? 'es-MX' : 'en-US', {
      hour: 'numeric',
      minute: '2-digit',
    })
  const busy = move.isPending || refund.isPending

  return (
    <>
      <header className="fs-drawer__head">
        <div>
          <h2 className="t-h2">
            #{order.orderNumber} <StatusBadge status={order.status} />
          </h2>
          <p>
            {t('adminOrders.placed', { time: formatDateTime(order.createdAt, language) })} ·{' '}
            {t(`cart.${order.fulfillmentType}`)}
          </p>
        </div>
        <button
          type="button"
          className="fs-drawer__close"
          onClick={onClose}
          aria-label={t('common.close')}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </header>

      <section className="fs-drawer__customer" aria-label={t('adminOrders.cols.customer')}>
        <span className="fs-avatar">
          {order.contact.name
            .split(/\s+/)
            .map((part) => part[0])
            .slice(0, 2)
            .join('')}
        </span>
        <div>
          <strong>{order.contact.name}</strong>
          {order.deliveryAddress && <small>{order.deliveryAddress}</small>}
        </div>
        <a
          href={`tel:${order.contact.phone}`}
          aria-label={t('adminOrders.call', { phone: order.contact.phone })}
        >
          <Phone size={16} aria-hidden="true" />
        </a>
        <a
          href={`mailto:${order.contact.email}`}
          aria-label={t('adminOrders.email', { email: order.contact.email })}
        >
          <Mail size={16} aria-hidden="true" />
        </a>
      </section>

      <section aria-labelledby="drawer-items">
        <h3 id="drawer-items" className="t-overline">
          {t('adminOrders.items')}
        </h3>
        <ul className="fs-drawer__items">
          {order.lines.map((line) => {
            const changes = describeChanges(line.ingredients, t)
            if (line.notes) changes.push(line.notes)
            return (
              <li key={line.id}>
                <span className="fs-ticket__qty">{line.quantity}×</span>
                <span>
                  {line.name}
                  {changes.length > 0 && <small>{changes.join(' · ')}</small>}
                </span>
                <span>{money(line.lineTotal)}</span>
              </li>
            )
          })}
        </ul>
      </section>

      <dl className="fs-drawer__totals">
        <div>
          <dt>{t('summary.subtotal')}</dt>
          <dd>{money(order.subtotal)}</dd>
        </div>
        <div>
          <dt>{t('adminOrders.paidWith')}</dt>
          <dd>{t(`tracking.payment.${order.paymentStatus}`)}</dd>
        </div>
        <div className="fs-drawer__total">
          <dt>{t('summary.total')}</dt>
          <dd>{money(order.total)}</dd>
        </div>
      </dl>

      <section aria-labelledby="drawer-activity">
        <h3 id="drawer-activity" className="t-overline">
          {t('adminOrders.activity')}
        </h3>
        <ol className="fs-drawer__activity">
          {order.history.map((entry, index) => (
            <li key={index}>
              <span aria-hidden="true">
                {entry.toStatus === 'received' ? (
                  <Receipt size={16} />
                ) : entry.toStatus === 'preparing' ? (
                  <Utensils size={16} />
                ) : (
                  <Check size={16} />
                )}
              </span>
              <div>
                <strong>{t(`adminOrders.activityLabel.${entry.toStatus}`)}</strong>
                <small>{time(entry.createdAt)}</small>
              </div>
            </li>
          ))}
          {next && (
            <li className="fs-drawer__activity--pending">
              <span aria-hidden="true">
                <Utensils size={16} />
              </span>
              <div>
                <strong>{t(`adminOrders.waiting.${order.status}`)}</strong>
                <small>—</small>
              </div>
            </li>
          )}
        </ol>
      </section>

      {(next || canReject || canRefund) && (
        <footer className="fs-drawer__actions">
          {confirming ? (
            <div className="fs-drawer__confirm" role="group" aria-label={t('adminOrders.confirm')}>
              <p>
                {t(
                  confirming === 'reject'
                    ? 'adminOrders.confirmReject'
                    : 'adminOrders.confirmRefund',
                  { total: money(order.total) },
                )}
              </p>
              <div>
                <Button variant="secondary" onClick={() => setConfirming(null)}>
                  {t('adminOrders.back')}
                </Button>
                <Button
                  variant="dark"
                  disabled={busy}
                  onClick={() =>
                    confirming === 'reject' ? move.mutate('cancelled') : refund.mutate()
                  }
                >
                  {t(
                    confirming === 'reject'
                      ? 'adminOrders.actions.reject'
                      : 'adminOrders.actions.refund',
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <>
              {canRefund && (
                <Button
                  variant="secondary"
                  icon={CreditCard}
                  onClick={() => setConfirming('refund')}
                >
                  {t('adminOrders.actions.refund')}
                </Button>
              )}
              {canReject && (
                <Button variant="secondary" onClick={() => setConfirming('reject')}>
                  {t('adminOrders.actions.reject')}
                </Button>
              )}
              {next && (
                <Button disabled={busy} onClick={() => move.mutate(next.to)}>
                  {t(next.label)}
                </Button>
              )}
            </>
          )}
        </footer>
      )}
    </>
  )
}
