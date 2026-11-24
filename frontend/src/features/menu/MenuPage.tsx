import type { TFunction } from 'i18next'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Outlet, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowRight,
  Chip,
  ChevronRight,
  EmptyState,
  ErrorBanner,
  ProductCard,
  Skeleton,
} from '../../design-system'
import type { MenuProduct, MenuSection } from '../../lib/api/types'
import { selectCartCount, useCartStore } from '../cart/cartStore'
import { useAddToCart } from '../cart/useAddToCart'
import { apiErrorMessage, formatHour } from '../shared/helpers'
import { useMenu, useMoney, useQuote, useStoreInfo } from '../shared/queries'
import { CartPanel } from './CartPanel'
import './MenuPage.css'

type Sort = 'popular' | 'priceAsc' | 'priceDesc'

function sortProducts(products: MenuProduct[], sort: Sort): MenuProduct[] {
  if (sort === 'popular') return products
  const direction = sort === 'priceAsc' ? 1 : -1
  return [...products].sort((a, b) => (Number(a.price) - Number(b.price)) * direction)
}

export function MenuPage() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const query = (searchParams.get('q') ?? '').trim().toLowerCase()
  const [category, setCategory] = useState<string>('all')
  const [sort, setSort] = useState<Sort>('popular')
  const { data: menu, isError, error, refetch } = useMenu()
  const { data: store } = useStoreInfo()

  const sections = useMemo(() => {
    if (!menu) return []
    return menu
      .filter((section) => category === 'all' || section.category.slug === category)
      .map((section) => ({
        ...section,
        products: sortProducts(
          section.products.filter(
            (product) =>
              !query ||
              product.name.toLowerCase().includes(query) ||
              product.description.toLowerCase().includes(query),
          ),
          sort,
        ),
      }))
      .filter((section) => section.products.length > 0)
  }, [menu, category, sort, query])

  return (
    <div className="fs-menu">
      <header className="fs-menu__header">
        <nav className="fs-menu__crumbs" aria-label={t('menu.breadcrumb')}>
          <Link to="/">{t('menu.home')}</Link>
          <ChevronRight size={14} aria-hidden="true" />
          <span aria-current="page">{t('nav.menu')}</span>
        </nav>
        <div className="fs-menu__title-row">
          <div>
            <h1 className="t-h1">{t('menu.title')}</h1>
            <p className="t-body-m fs-menu__subtitle">
              {t('menu.subtitle')}
              {store && ` · ${t('menu.kitchenOpenUntil', { time: formatHour(store.closesAt) })}`}
            </p>
          </div>
          {store && (
            <span
              className={
                store.isOpen ? 'fs-menu__status' : 'fs-menu__status fs-menu__status--closed'
              }
            >
              <span aria-hidden="true" />
              {store.isOpen
                ? t('menu.openNow', { minutes: store.waitMinutes })
                : t('menu.closedOpensAt', { time: formatHour(store.opensAt) })}
            </span>
          )}
        </div>
        <div className="fs-menu__controls">
          <div className="fs-menu__chips" role="group" aria-label={t('menu.categories')}>
            <Chip active={category === 'all'} onClick={() => setCategory('all')}>
              {t('menu.all')}
            </Chip>
            {menu?.map(({ category: c }) => (
              <Chip key={c.slug} active={category === c.slug} onClick={() => setCategory(c.slug)}>
                {c.name}
              </Chip>
            ))}
          </div>
          <label className="fs-menu__sort">
            <span className="sr-only">{t('menu.sortLabel')}</span>
            <select value={sort} onChange={(event) => setSort(event.target.value as Sort)}>
              <option value="popular">{t('menu.sort.popular')}</option>
              <option value="priceAsc">{t('menu.sort.priceAsc')}</option>
              <option value="priceDesc">{t('menu.sort.priceDesc')}</option>
            </select>
          </label>
        </div>
        {query && <p className="fs-menu__query">{t('menu.searching', { query })}</p>}
      </header>

      <div className="fs-menu__body">
        <div className="fs-menu__grid">
          {isError ? (
            <ErrorBanner
              message={apiErrorMessage(error, t)}
              retryLabel={t('common.retry')}
              onRetry={() => void refetch()}
            />
          ) : !menu ? (
            <MenuSkeleton />
          ) : sections.length === 0 ? (
            <EmptyState title={t('menu.empty')} description={t('menu.emptyHint')} />
          ) : (
            sections.map((section) => <Section key={section.category.slug} section={section} />)
          )}
        </div>
        <CartPanel />
      </div>

      <FloatingCartBar />
      <Outlet />
    </div>
  )
}

function Section({ section }: { section: MenuSection }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const money = useMoney()
  const addToCart = useAddToCart()

  return (
    <section className="fs-menu__section" aria-labelledby={`cat-${section.category.slug}`}>
      <div className="fs-menu__section-head">
        <h2 id={`cat-${section.category.slug}`} className="t-h4">
          {section.category.name}
        </h2>
        <span className="t-label-s">{t('menu.itemCount', { count: section.products.length })}</span>
      </div>
      <div className="fs-menu__cards">
        {section.products.map((product) => (
          <ProductCard
            key={product.id}
            name={product.name}
            description={product.description}
            price={money(product.price)}
            meta={productMeta(product, t)}
            image={product.image}
            addLabel={t('common.addToCart')}
            disabled={!product.isAvailable || product.stock === 0}
            onAdd={() => addToCart(product)}
            onSelect={() => navigate(`/menu/${product.id}`)}
          />
        ))}
      </div>
    </section>
  )
}

function MenuSkeleton() {
  return (
    <div className="fs-menu__cards" aria-busy="true">
      {Array.from({ length: 6 }, (_, index) => (
        <Skeleton key={index} style={{ height: 332, borderRadius: 20 }} />
      ))}
    </div>
  )
}

/** Mobile: pinned bar above the tab bar showing count, ETA and total (Figma M1 "floating-cart"). */
function FloatingCartBar() {
  const { t } = useTranslation()
  const money = useMoney()
  const { data: store } = useStoreInfo()
  const items = useCartStore((s) => s.items)
  const count = useCartStore(selectCartCount)
  const fulfillmentType = useCartStore((s) => s.fulfillmentType)
  const promoCode = useCartStore((s) => s.promoCode)
  const { data: quote } = useQuote({ items, promoCode, fulfillmentType })

  if (count === 0) return null

  return (
    <Link to="/cart" className="fs-floating-cart">
      <span className="fs-floating-cart__count">{count}</span>
      <span className="fs-floating-cart__text">
        <strong>{t('cart.viewCart')}</strong>
        <span>{t('cart.readyInApprox', { minutes: store?.waitMinutes ?? 15 })}</span>
      </span>
      <span className="fs-floating-cart__total">{quote ? money(quote.total) : '…'}</span>
      <span className="fs-floating-cart__go">
        <ArrowRight size={18} aria-hidden="true" />
      </span>
    </Link>
  )
}

function productMeta(product: MenuProduct, t: TFunction) {
  const parts: string[] = []
  if (product.prepTimeMin && product.prepTimeMax) {
    parts.push(
      product.prepTimeMin === product.prepTimeMax
        ? t('product.prepSingle', { min: product.prepTimeMax })
        : t('product.prep', { min: product.prepTimeMin, max: product.prepTimeMax }),
    )
  }
  if (product.calories !== null) parts.push(t('product.caloriesValue', { count: product.calories }))
  return parts.join(' · ')
}
