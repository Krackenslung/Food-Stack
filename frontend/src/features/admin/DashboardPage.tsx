import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../app/providers/AuthProvider'
import { useLanguage } from '../../app/providers/LanguageProvider'
import {
  ArrowRight,
  Button,
  Clock,
  ErrorBanner,
  KpiCard,
  Receipt,
  SegmentedControl,
  Skeleton,
  Trending,
  Users,
} from '../../design-system'
import { api } from '../../lib/api/endpoints'
import type { DashboardRange } from '../../lib/api/types'
import { formatPrepSeconds } from '../kitchen/kitchen'
import { apiErrorMessage } from '../shared/helpers'
import { useMoney, useStoreInfo } from '../shared/queries'
import { StatusBadge } from '../shared/StatusBadge'
import { RevenueChart } from './RevenueChart'
import './admin.css'
import './DashboardPage.css'

const RANGES: DashboardRange[] = ['7d', '30d', '90d']

const pct = (value: number) => `${value >= 0 ? '▲' : '▼'} ${Math.abs(value).toFixed(1)}%`

export function DashboardPage() {
  const { t } = useTranslation()
  const { language } = useLanguage()
  const { user } = useAuth()
  const money = useMoney()
  const navigate = useNavigate()
  const { data: store } = useStoreInfo()
  const [range, setRange] = useState<DashboardRange>('7d')

  const { data, isError, error, refetch, isPending } = useQuery({
    queryKey: ['dashboard', range, language],
    queryFn: () => api.dashboard(range),
    refetchInterval: 30_000,
  })

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'morning' : hour < 19 ? 'afternoon' : 'evening'

  if (isError) {
    return (
      <ErrorBanner
        message={apiErrorMessage(error, t)}
        retryLabel={t('common.retry')}
        onRetry={() => void refetch()}
      />
    )
  }

  const top = data ? Math.max(...data.bestSellers.map((item) => item.sold)) : 1

  return (
    <div className="fs-dashboard">
      <header className="fs-dashboard__head">
        <div>
          <h1 className="t-h1">
            {t(`dashboard.greeting.${greeting}`, { name: user?.name ?? '' })}
          </h1>
          <p className="t-body-m">
            {t('dashboard.subtitle', { store: store?.name ?? 'FoodStack' })}
          </p>
        </div>
        <div className="fs-dashboard__actions">
          {data && (
            <span className="fs-dashboard__live">
              <span aria-hidden="true" />
              {t('dashboard.live', { count: data.ordersInKitchen })}
            </span>
          )}
          <Button onClick={() => navigate('/admin/products/new')}>{t('products.new')}</Button>
        </div>
      </header>

      <section className="fs-dashboard__kpis" aria-label={t('dashboard.kpis')}>
        {isPending ? (
          Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} style={{ height: 166, borderRadius: 16 }} />
          ))
        ) : (
          <>
            <KpiCard
              label={t('dashboard.revenueToday')}
              value={money(data.kpis.revenue.value)}
              delta={pct(data.kpis.revenue.deltaPct)}
              period={t('dashboard.vsPrevious')}
              icon={Trending}
            />
            <KpiCard
              label={t('dashboard.orders')}
              value={data.kpis.orders.value}
              delta={pct(data.kpis.orders.deltaPct)}
              period={t('dashboard.vsPrevious')}
              icon={Receipt}
            />
            <KpiCard
              label={t('dashboard.avgTicket')}
              value={money(data.kpis.avgTicket.value)}
              delta={pct(data.kpis.avgTicket.deltaPct)}
              period={t('dashboard.vsPrevious')}
              icon={Users}
            />
            <KpiCard
              label={t('dashboard.avgPrep')}
              value={formatPrepSeconds(data.kpis.avgPrepSeconds.value)}
              delta={`${data.kpis.avgPrepSeconds.deltaSeconds <= 0 ? '▼' : '▲'} ${formatPrepSeconds(Math.abs(data.kpis.avgPrepSeconds.deltaSeconds))}`}
              deltaTone={data.kpis.avgPrepSeconds.deltaSeconds <= 0 ? 'success' : 'danger'}
              period={t('dashboard.fasterThanAvg')}
              icon={Clock}
            />
          </>
        )}
      </section>

      <div className="fs-dashboard__grid">
        <section className="fs-dashboard__card" aria-labelledby="revenue-title">
          <div className="fs-dashboard__card-head">
            <div>
              <h2 id="revenue-title" className="t-h4">
                {t('dashboard.revenue')}
              </h2>
              <p className="fs-dashboard__total">
                {data ? money(data.revenueTotal) : '…'}
                {data && (
                  <span>{t('dashboard.thisPeriod', { pct: `+${data.revenueDeltaPct}%` })}</span>
                )}
              </p>
            </div>
            <SegmentedControl<DashboardRange>
              ariaLabel={t('dashboard.range')}
              value={range}
              onChange={setRange}
              options={RANGES.map((value) => ({ value, label: value.toUpperCase() }))}
            />
          </div>
          {data ? (
            <RevenueChart series={data.series} language={language} range={range} />
          ) : (
            <Skeleton style={{ height: 280 }} />
          )}
        </section>

        <section className="fs-dashboard__card" aria-labelledby="best-title">
          <div className="fs-dashboard__card-head">
            <h2 id="best-title" className="t-h4">
              {t('dashboard.bestSellers')}
            </h2>
            <Link to="/admin/products">{t('dashboard.viewAll')}</Link>
          </div>
          <ol className="fs-dashboard__best">
            {data?.bestSellers.map((item) => (
              <li key={item.productId}>
                <img src={item.image} alt="" />
                <div>
                  <p>
                    <strong>{item.name}</strong>
                    <span>{money(item.revenue)}</span>
                  </p>
                  <progress value={item.sold} max={top} aria-label={item.name} />
                  <small>{t('dashboard.sold', { count: item.sold })}</small>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <section className="fs-dashboard__card" aria-labelledby="recent-title">
        <div className="fs-dashboard__card-head">
          <h2 id="recent-title" className="t-h4">
            {t('dashboard.recentOrders')}
          </h2>
          <Link to="/admin/orders" className="fs-dashboard__more">
            {t('dashboard.viewAllOrders')}
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
        <div className="fs-table-wrap">
          <table className="fs-table">
            <thead>
              <tr>
                <th scope="col">{t('adminOrders.cols.order')}</th>
                <th scope="col">{t('adminOrders.cols.customer')}</th>
                <th scope="col">{t('adminOrders.cols.items')}</th>
                <th scope="col">{t('adminOrders.cols.type')}</th>
                <th scope="col">{t('adminOrders.cols.status')}</th>
                <th scope="col">{t('adminOrders.cols.total')}</th>
                <th scope="col">{t('adminOrders.cols.time')}</th>
              </tr>
            </thead>
            <tbody>
              {data?.recentOrders.map((order) => (
                <tr key={order.id}>
                  <td>
                    <Link to={`/admin/orders?order=${order.id}`}>#{order.orderNumber}</Link>
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
                    {order.items
                      .map((i) => (i.quantity > 1 ? `${i.quantity}× ${i.name}` : i.name))
                      .join(', ')}
                  </td>
                  <td>{t(`cart.${order.fulfillmentType}`)}</td>
                  <td>
                    <StatusBadge status={order.status} />
                  </td>
                  <td>{money(order.total)}</td>
                  <td>
                    {new Date(order.createdAt).toLocaleTimeString(
                      language === 'es' ? 'es-MX' : 'en-US',
                      {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false,
                      },
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
