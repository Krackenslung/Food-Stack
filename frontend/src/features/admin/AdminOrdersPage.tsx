import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import { useLanguage } from '../../app/providers/LanguageProvider'
import { Chip, ErrorBanner, Home, Skeleton, Truck } from '../../design-system'
import { api } from '../../lib/api/endpoints'
import type { OrderStatus } from '../../lib/api/types'
import { apiErrorMessage, pageList } from '../shared/helpers'
import { useMoney } from '../shared/queries'
import { StatusBadge } from '../shared/StatusBadge'
import { OrderDrawer } from './OrderDrawer'
import './admin.css'
import './AdminOrdersPage.css'

const PAGE_SIZE = 10

type Filter = 'all' | 'received' | 'preparing' | 'ready' | 'completed' | 'cancelled'
const FILTERS: Filter[] = ['all', 'received', 'preparing', 'ready', 'completed', 'cancelled']

export function AdminOrdersPage() {
  const { t } = useTranslation()
  const { language } = useLanguage()
  const money = useMoney()
  const [params, setParams] = useSearchParams()
  const [filter, setFilter] = useState<Filter>('all')
  const [page, setPage] = useState(1)
  const selected = Number(params.get('order')) || null

  const { data, isError, error, refetch, isPending } = useQuery({
    queryKey: ['admin-orders', filter, page, language],
    queryFn: () => api.adminOrders({ status: filter, page, pageSize: PAGE_SIZE }, language),
    placeholderData: keepPreviousData,
    refetchInterval: 10_000, // "auto-refresh every 10s"
  })

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1
  const open = (id: number | null) => {
    const next = new URLSearchParams(params)
    if (id === null) next.delete('order')
    else next.set('order', String(id))
    setParams(next, { replace: true })
  }

  return (
    <div className="fs-admin-orders">
      <header>
        <h1 className="t-h1">{t('adminOrders.title')}</h1>
        <p className="t-body-m">{t('adminOrders.subtitle', { count: data?.counts.all ?? 0 })}</p>
      </header>

      <div className="fs-admin-orders__filters" role="group" aria-label={t('orders.filters')}>
        {FILTERS.map((value) => {
          const count = value === 'all' ? null : data?.counts[value as OrderStatus]
          return (
            <Chip
              key={value}
              active={filter === value}
              onClick={() => {
                setFilter(value)
                setPage(1)
              }}
            >
              {t(`adminOrders.filter.${value}`)}
              {count ? ` · ${count}` : ''}
            </Chip>
          )
        })}
      </div>

      {isError ? (
        <ErrorBanner
          message={apiErrorMessage(error, t)}
          retryLabel={t('common.retry')}
          onRetry={() => void refetch()}
        />
      ) : (
        <section className="fs-admin-orders__card" aria-label={t('adminOrders.title')}>
          {isPending ? (
            <Skeleton style={{ height: 320 }} />
          ) : data.items.length === 0 ? (
            <p className="fs-admin-orders__empty">{t('adminOrders.empty')}</p>
          ) : (
            <div className="fs-table-wrap">
              <table className="fs-table">
                <thead>
                  <tr>
                    <th scope="col">{t('adminOrders.cols.order')}</th>
                    <th scope="col">{t('adminOrders.cols.customer')}</th>
                    <th scope="col">{t('adminOrders.cols.type')}</th>
                    <th scope="col">{t('adminOrders.cols.payment')}</th>
                    <th scope="col">{t('adminOrders.cols.status')}</th>
                    <th scope="col">{t('adminOrders.cols.total')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((order) => {
                    const Icon = order.fulfillmentType === 'delivery' ? Truck : Home
                    return (
                      <tr
                        key={order.id}
                        data-clickable="true"
                        data-selected={selected === order.id}
                        onClick={() => open(order.id)}
                      >
                        <td>
                          <Link
                            to={`/admin/orders?order=${order.id}`}
                            onClick={(event) => {
                              event.preventDefault()
                              event.stopPropagation()
                              open(order.id)
                            }}
                          >
                            #{order.orderNumber}
                          </Link>
                          <small>
                            {new Date(order.createdAt).toLocaleTimeString(
                              language === 'es' ? 'es-MX' : 'en-US',
                              { hour: '2-digit', minute: '2-digit', hour12: false },
                            )}
                          </small>
                        </td>
                        <td>
                          <span className="fs-avatar">
                            {order.customerName
                              .split(/\s+/)
                              .map((part) => part[0])
                              .slice(0, 2)
                              .join('')}
                          </span>
                          {order.customerName}
                        </td>
                        <td>
                          <span className="fs-admin-orders__type">
                            <Icon size={14} aria-hidden="true" />
                            {t(`cart.${order.fulfillmentType}`)}
                          </span>
                        </td>
                        <td>{t(`adminOrders.pay.${order.paymentMethod}`)}</td>
                        <td>
                          <StatusBadge status={order.status} />
                        </td>
                        <td>{money(order.total)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {totalPages > 1 && (
        <nav className="fs-admin-orders__pages" aria-label={t('orders.pagination')}>
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

      {selected !== null && (
        <OrderDrawer key={selected} orderId={selected} onClose={() => open(null)} />
      )}
    </div>
  )
}
