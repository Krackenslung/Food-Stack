import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../app/providers/AuthProvider'
import { useLanguage } from '../../app/providers/LanguageProvider'
import { useToast } from '../../app/providers/ToastProvider'
import {
  ArrowRight,
  Button,
  Chip,
  EmptyState,
  ErrorBanner,
  Logout,
  Receipt,
  Skeleton,
} from '../../design-system'
import { api } from '../../lib/api/endpoints'
import type { OrderSummary } from '../../lib/api/types'
import { initialsOf } from '../../lib/auth'
import { formatDateTime } from '../../lib/format'
import { useCartStore } from '../cart/cartStore'
import { apiErrorMessage, isActiveStatus, pageList } from '../shared/helpers'
import { useMoney } from '../shared/queries'
import { StatusBadge } from '../shared/StatusBadge'
import './MyOrdersPage.css'

const PAGE_SIZE = 5
const FILTERS = ['all', 'active', 'completed', 'cancelled'] as const
type Filter = (typeof FILTERS)[number]

export function MyOrdersPage() {
  const { t } = useTranslation()
  const { language } = useLanguage()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [filter, setFilter] = useState<Filter>('all')
  const [page, setPage] = useState(1)

  const { data, isError, error, refetch, isPending } = useQuery({
    queryKey: ['my-orders', filter, page, language],
    queryFn: () =>
      api.myOrders(
        { status: filter === 'all' ? undefined : filter, page, pageSize: PAGE_SIZE },
        language,
      ),
    placeholderData: keepPreviousData,
    // Active orders change status on their own.
    refetchInterval: 10_000,
  })

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1

  return (
    <div className="fs-page fs-orders">
      <aside className="fs-orders__side">
        <div className="fs-orders__profile">
          <span className="fs-orders__avatar" aria-hidden="true">
            {initialsOf(user)}
          </span>
          <strong>{user ? `${user.name} ${user.lastname}`.trim() : ''}</strong>
          <span>{user?.email}</span>
        </div>
        <nav className="fs-orders__menu" aria-label={t('orders.account')}>
          <span className="fs-orders__menu-item fs-orders__menu-item--active" aria-current="page">
            <Receipt size={18} aria-hidden="true" />
            {t('orders.myOrders')}
          </span>
          <button
            type="button"
            className="fs-orders__menu-item"
            onClick={() => {
              void logout().then(() => navigate('/login'))
            }}
          >
            <Logout size={18} aria-hidden="true" />
            {t('orders.signOut')}
          </button>
        </nav>
      </aside>

      <section className="fs-orders__main">
        <header>
          <h1 className="t-h1">{t('pages.myOrders')}</h1>
          <p className="t-body-m">{t('orders.subtitle')}</p>
        </header>

        <div className="fs-orders__filters" role="group" aria-label={t('orders.filters')}>
          {FILTERS.map((value) => (
            <Chip
              key={value}
              active={filter === value}
              onClick={() => {
                setFilter(value)
                setPage(1)
              }}
            >
              {t(`orders.filter.${value}`)}
            </Chip>
          ))}
        </div>

        {isError ? (
          <ErrorBanner
            message={apiErrorMessage(error, t)}
            retryLabel={t('common.retry')}
            onRetry={() => void refetch()}
          />
        ) : isPending ? (
          <div className="fs-orders__list" aria-busy="true">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} style={{ height: 88, borderRadius: 16 }} />
            ))}
          </div>
        ) : data.items.length === 0 ? (
          <EmptyState
            title={t('orders.empty')}
            description={t('orders.emptyHint')}
            action={
              <Button onClick={() => navigate('/menu')} icon={ArrowRight}>
                {t('cart.browseMenu')}
              </Button>
            }
          />
        ) : (
          <>
            <ul className="fs-orders__list">
              {data.items.map((order) => (
                <OrderRow key={order.id} order={order} />
              ))}
            </ul>
            {totalPages > 1 && (
              <nav className="fs-orders__pages" aria-label={t('orders.pagination')}>
                {pageList(page, totalPages).map((entry, index) =>
                  entry === 'gap' ? (
                    <span key={`gap-${index}`} aria-hidden="true">
                      …
                    </span>
                  ) : (
                    <button
                      key={entry}
                      type="button"
                      aria-current={entry === page ? 'page' : undefined}
                      onClick={() => setPage(entry)}
                    >
                      {entry}
                    </button>
                  ),
                )}
              </nav>
            )}
          </>
        )}
      </section>
    </div>
  )
}

function OrderRow({ order }: { order: OrderSummary }) {
  const { t } = useTranslation()
  const { language } = useLanguage()
  const money = useMoney()
  const navigate = useNavigate()
  const toast = useToast()
  const add = useCartStore((s) => s.add)
  const active = isActiveStatus(order.status)
  const [busy, setBusy] = useState(false)

  const names = order.items.map((item) =>
    item.quantity > 1 ? `${item.name} ×${item.quantity}` : item.name,
  )
  const summary =
    names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', ')

  async function reorder() {
    setBusy(true)
    try {
      const detail = await api.order(order.id, language)
      for (const line of detail.lines) {
        add({
          productId: line.productId,
          name: line.name,
          image: line.image,
          quantity: line.quantity,
          ingredients: line.ingredients
            .filter((ingredient) => ingredient.quantity !== ingredient.default)
            .map((ingredient) => ({
              productIngredientId: ingredient.productIngredientId,
              name: ingredient.name,
              quantity: ingredient.quantity,
              default: ingredient.default,
            })),
          notes: line.notes,
        })
      }
      toast.show(t('orders.reordered'))
      navigate('/cart')
    } catch (error) {
      toast.show(apiErrorMessage(error, t))
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className={active ? 'fs-order-row fs-order-row--active' : 'fs-order-row'}>
      <span className="fs-order-row__thumbs" aria-hidden="true">
        {order.items.slice(0, 3).map((item, index) => (
          <img key={index} src={item.image} alt="" />
        ))}
      </span>
      <div className="fs-order-row__info">
        <strong>
          #{order.orderNumber}
          <span>{formatDateTime(order.createdAt, language)}</span>
        </strong>
        <span>{summary}</span>
      </div>
      <StatusBadge status={order.status} />
      <span className="fs-order-row__total">{money(order.total)}</span>
      {active ? (
        <Link to={`/orders/${order.id}`} className="fs-order-row__track">
          {t('orders.track')}
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      ) : (
        <Button variant="secondary" disabled={busy} onClick={() => void reorder()}>
          {t('orders.reorder')}
        </Button>
      )}
    </li>
  )
}
