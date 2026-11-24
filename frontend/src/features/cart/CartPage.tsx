import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Button,
  Clock,
  EmptyState,
  ErrorBanner,
  Plus,
  Shield,
} from '../../design-system'
import { useAuth } from '../../app/providers/AuthProvider'
import { apiErrorMessage } from '../shared/helpers'
import { useMenu, useMoney, useQuote, useStoreInfo } from '../shared/queries'
import { useAddToCart } from './useAddToCart'
import { CartSummary } from './CartSummary'
import { PromoCodeField } from './PromoCodeField'
import { selectCartCount, useCartStore } from './cartStore'
import './CartPage.css'
import { CartLines } from './CartLines'

export function CartPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: store } = useStoreInfo()
  const items = useCartStore((s) => s.items)
  const promoCode = useCartStore((s) => s.promoCode)
  const fulfillmentType = useCartStore((s) => s.fulfillmentType)
  const count = useCartStore(selectCartCount)
  const { data: quote, isError, error, refetch } = useQuote({ items, promoCode, fulfillmentType })

  if (items.length === 0) {
    return (
      <div className="fs-page">
        <h1 className="sr-only">{t('pages.cart')}</h1>
        <EmptyState
          title={t('cart.emptyTitle')}
          description={t('cart.emptyHint')}
          action={
            <Button onClick={() => navigate('/menu')} icon={ArrowRight}>
              {t('cart.browseMenu')}
            </Button>
          }
        />
      </div>
    )
  }

  const readyAt = new Date(Date.now() + (store?.waitMinutes ?? 15) * 60_000)

  return (
    <div className="fs-page fs-cart-page">
      <header className="fs-cart-page__head">
        <div>
          <h1 className="t-h1">{t('pages.cart')}</h1>
          <p className="t-body-m fs-cart-page__sub">
            {t('cart.itemCount', { count })}
            {store &&
              ` · ${t(fulfillmentType === 'pickup' ? 'cart.pickupAt' : 'cart.deliveryFrom', { store: store.name })}`}
          </p>
        </div>
        <Button variant="secondary" onClick={() => navigate('/menu')}>
          {t('cart.continueShopping')}
        </Button>
      </header>

      <div className="fs-cart-page__layout">
        <div className="fs-cart-page__main">
          {isError && (
            <ErrorBanner
              message={apiErrorMessage(error, t)}
              retryLabel={t('common.retry')}
              onRetry={() => void refetch()}
            />
          )}
          <section className="fs-cart-page__lines" aria-label={t('pages.cart')}>
            <CartLines items={items} quoteLines={quote?.lines} />
          </section>
          <Suggestions />
        </div>

        <aside className="fs-cart-page__summary" aria-label={t('cart.summaryTitle')}>
          <h2 className="t-h3">{t('cart.summaryTitle')}</h2>
          <div className="fs-cart-page__eta">
            <Clock size={20} aria-hidden="true" />
            <div>
              <strong>
                {fulfillmentType === 'pickup' ? t('cart.pickupAsap') : t('cart.deliveryAsap')}
              </strong>
              <span>
                {t('cart.estimatedReady', {
                  time: readyAt.toLocaleTimeString(undefined, {
                    hour: 'numeric',
                    minute: '2-digit',
                  }),
                })}
              </span>
            </div>
          </div>
          <PromoCodeField promo={quote?.promo} />
          <CartSummary quote={quote} itemCount={count} />
          <Button
            size="L"
            icon={ArrowRight}
            className="fs-cart-page__cta"
            disabled={!quote}
            onClick={() => navigate('/checkout')}
          >
            {user ? t('cart.goToCheckout') : t('cart.loginToCheckout')}
          </Button>
          <p className="fs-cart-page__note">
            <Shield size={14} aria-hidden="true" />
            {t('cart.freeCancel')}
          </p>
        </aside>
      </div>
    </div>
  )
}

/** "Complete your meal": sides and beverages not yet in the cart. */
function Suggestions() {
  const { t } = useTranslation()
  const money = useMoney()
  const { data: menu } = useMenu()
  const items = useCartStore((s) => s.items)
  const addToCart = useAddToCart()

  const inCart = new Set(items.map((item) => item.productId))
  const suggestions =
    menu
      ?.filter(
        (section) => section.category.slug === 'sides' || section.category.slug === 'beverages',
      )
      .flatMap((section) => section.products)
      .filter((product) => product.isAvailable && !inCart.has(product.id))
      .slice(0, 2) ?? []

  if (suggestions.length === 0) return null

  return (
    <section className="fs-cart-page__suggest" aria-labelledby="complete-meal">
      <h2 id="complete-meal" className="t-h4">
        {t('cart.completeMeal')}
      </h2>
      <p>{t('cart.completeMealHint')}</p>
      <ul>
        {suggestions.map((product) => (
          <li key={product.id}>
            <img src={product.image} alt="" />
            <span>
              <strong>{product.name}</strong>
              <span>{money(product.price)}</span>
            </span>
            <button
              type="button"
              aria-label={t('common.addNamed', { name: product.name })}
              onClick={() => addToCart(product)}
            >
              <Plus size={18} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
