import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useDeferredValue, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { useLanguage } from '../../app/providers/LanguageProvider'
import { useToast } from '../../app/providers/ToastProvider'
import {
  Badge,
  Button,
  Chip,
  Edit,
  ErrorBanner,
  Search,
  Skeleton,
  Toggle,
} from '../../design-system'
import type { BadgeTone } from '../../design-system'
import { api } from '../../lib/api/endpoints'
import type { AdminProductRow, AdminProductsPage } from '../../lib/api/types'
import { apiErrorMessage, pageList } from '../shared/helpers'
import { useMoney } from '../shared/queries'
import './admin.css'
import './ProductsPage.css'

const PAGE_SIZE = 10

export function productState(
  row: Pick<AdminProductRow, 'publishStatus' | 'stock' | 'lowStockThreshold' | 'isAvailable'>,
): {
  key: 'draft' | 'out' | 'low' | 'hidden' | 'active'
  tone: BadgeTone
} {
  if (row.publishStatus === 'draft') return { key: 'draft', tone: 'neutral' }
  if (row.stock === 0) return { key: 'out', tone: 'danger' }
  if (row.stock !== null && row.stock < row.lowStockThreshold)
    return { key: 'low', tone: 'warning' }
  if (!row.isAvailable) return { key: 'hidden', tone: 'neutral' }
  return { key: 'active', tone: 'success' }
}

export function ProductsPage() {
  const { t } = useTranslation()
  const { language } = useLanguage()
  const navigate = useNavigate()
  const money = useMoney()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [category, setCategory] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const q = useDeferredValue(search.trim())

  const queryKey = ['admin-products', category, q, page, language]
  const { data, isError, error, refetch, isPending } = useQuery({
    queryKey,
    queryFn: () => api.adminProducts({ category, q, page, pageSize: PAGE_SIZE }, language),
    placeholderData: keepPreviousData,
  })

  const toggle = useMutation({
    mutationFn: ({ id, value }: { id: number; value: boolean }) =>
      api.setProductAvailability(id, value),
    // Optimistic: the switch flips right away and snaps back if the API refuses.
    onMutate: async ({ id, value }) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<AdminProductsPage>(queryKey)
      if (previous) {
        queryClient.setQueryData<AdminProductsPage>(queryKey, {
          ...previous,
          items: previous.items.map((row) =>
            row.id === id ? { ...row, isAvailable: value } : row,
          ),
        })
      }
      return { previous }
    },
    onError: (failure, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous)
      toast.show(apiErrorMessage(failure, t))
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-products'] })
      void queryClient.invalidateQueries({ queryKey: ['menu'] })
    },
  })

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1
  const categories = Object.keys(data?.categoryCounts ?? {}).filter((key) => key !== 'all')

  return (
    <div className="fs-products">
      <header className="fs-products__head">
        <div>
          <h1 className="t-h1">{t('products.title')}</h1>
          <p className="t-body-m">
            {t('products.subtitle', {
              count: data?.categoryCounts.all ?? 0,
              categories: categories.length,
            })}
          </p>
        </div>
        <Button onClick={() => navigate('/admin/products/new')}>{t('products.add')}</Button>
      </header>

      <section className="fs-products__stats" aria-label={t('products.stats')}>
        {[
          { key: 'active', tone: 'success', value: data?.stats.active },
          { key: 'lowStock', tone: 'warning', value: data?.stats.lowStock },
          { key: 'outOfStock', tone: 'danger', value: data?.stats.outOfStock },
          { key: 'drafts', tone: 'neutral', value: data?.stats.drafts },
        ].map((stat) => (
          <div key={stat.key} className="fs-products__stat">
            <div>
              <span>{t(`products.stat.${stat.key}`)}</span>
              <strong>{stat.value ?? '–'}</strong>
            </div>
            <Badge tone={stat.tone as BadgeTone}>{t(`products.statHint.${stat.key}`)}</Badge>
          </div>
        ))}
      </section>

      <section className="fs-products__card">
        <div className="fs-products__tools">
          <div className="fs-products__chips" role="group" aria-label={t('menu.categories')}>
            <Chip
              active={category === 'all'}
              onClick={() => {
                setCategory('all')
                setPage(1)
              }}
            >
              {t('products.allCount', { count: data?.categoryCounts.all ?? 0 })}
            </Chip>
            {categories.map((slug) => (
              <Chip
                key={slug}
                active={category === slug}
                onClick={() => {
                  setCategory(slug)
                  setPage(1)
                }}
              >
                {t(`products.categories.${slug}`)}
              </Chip>
            ))}
          </div>
          <label className="fs-products__search">
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              value={search}
              placeholder={t('products.search')}
              aria-label={t('products.search')}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
            />
          </label>
        </div>

        {isError ? (
          <ErrorBanner
            message={apiErrorMessage(error, t)}
            retryLabel={t('common.retry')}
            onRetry={() => void refetch()}
          />
        ) : isPending ? (
          <Skeleton style={{ height: 320 }} />
        ) : data.items.length === 0 ? (
          <p className="fs-products__empty">{t('products.empty')}</p>
        ) : (
          <div className="fs-table-wrap">
            <table className="fs-table">
              <thead>
                <tr>
                  <th scope="col">{t('products.cols.product')}</th>
                  <th scope="col">{t('products.cols.category')}</th>
                  <th scope="col">{t('products.cols.price')}</th>
                  <th scope="col">{t('products.cols.stock')}</th>
                  <th scope="col">{t('products.cols.status')}</th>
                  <th scope="col">{t('products.cols.available')}</th>
                  <th scope="col">
                    <span className="sr-only">{t('products.cols.actions')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((row) => {
                  const state = productState(row)
                  const fill =
                    row.stock === null
                      ? 100
                      : Math.min(100, (row.stock / (row.lowStockThreshold * 5)) * 100)
                  return (
                    <tr key={row.id}>
                      <td>
                        <div className="fs-products__name">
                          <img src={row.image} alt="" />
                          <div>
                            <Link to={`/admin/products/${row.id}`}>{row.name}</Link>
                            <small>
                              {row.sku} ·{' '}
                              {t('products.ingredientCount', { count: row.ingredientCount })}
                            </small>
                          </div>
                        </div>
                      </td>
                      <td>{row.category.name}</td>
                      <td>{money(row.price)}</td>
                      <td>
                        <div className="fs-products__stock" data-state={state.key}>
                          <span>
                            {row.stock === null
                              ? t('products.untracked')
                              : t('products.units', { count: row.stock })}
                          </span>
                          <div aria-hidden="true">
                            <i style={{ width: `${fill}%` }} />
                          </div>
                        </div>
                      </td>
                      <td>
                        <Badge tone={state.tone}>{t(`products.state.${state.key}`)}</Badge>
                      </td>
                      <td>
                        <Toggle
                          checked={row.isAvailable}
                          label={t('products.availableFor', { name: row.name })}
                          onChange={(value) => toggle.mutate({ id: row.id, value })}
                        />
                      </td>
                      <td>
                        <Link
                          to={`/admin/products/${row.id}`}
                          className="fs-products__edit"
                          aria-label={t('products.editNamed', { name: row.name })}
                        >
                          <Edit size={16} aria-hidden="true" />
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {data && (
          <footer className="fs-products__foot">
            <span>{t('products.showing', { shown: data.items.length, total: data.total })}</span>
            {totalPages > 1 && (
              <nav aria-label={t('orders.pagination')}>
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
          </footer>
        )}
      </section>
    </div>
  )
}
