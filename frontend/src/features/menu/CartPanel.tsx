import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Badge,
  Button,
  Home,
  SegmentedControl,
  Shield,
  Truck,
} from '../../design-system'
import type { FulfillmentType } from '../../lib/api/types'
import { CartLines } from '../cart/CartLines'
import { PromoCodeField } from '../cart/PromoCodeField'
import { CartSummary } from '../cart/CartSummary'
import { selectCartCount, useCartStore } from '../cart/cartStore'
import { useMoney, useQuote, useStoreInfo } from '../shared/queries'
import './CartPanel.css'

/** Live cart beside the menu (desktop). On mobile the floating cart bar takes this role. */
export function CartPanel() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const money = useMoney()
  const { data: store } = useStoreInfo()
  const items = useCartStore((s) => s.items)
  const promoCode = useCartStore((s) => s.promoCode)
  const fulfillmentType = useCartStore((s) => s.fulfillmentType)
  const setFulfillmentType = useCartStore((s) => s.setFulfillmentType)
  const count = useCartStore(selectCartCount)
  const { data: quote } = useQuote({ items, promoCode, fulfillmentType })

  return (
    <aside className="fs-cart-panel" aria-label={t('cart.panelTitle')}>
      <div className="fs-cart-panel__head">
        <h2 className="t-h3">{t('cart.panelTitle')}</h2>
        <Badge tone="brand">{t('cart.itemCount', { count })}</Badge>
      </div>

      <SegmentedControl<FulfillmentType>
        ariaLabel={t('cart.fulfillment')}
        value={fulfillmentType}
        onChange={setFulfillmentType}
        options={[
          { value: 'pickup', label: t('cart.pickup'), icon: Home },
          { value: 'delivery', label: t('cart.delivery'), icon: Truck },
        ]}
      />

      {items.length === 0 ? (
        <p className="fs-cart-panel__empty">{t('cart.emptyHint')}</p>
      ) : (
        <>
          <CartLines items={items} quoteLines={quote?.lines} compact />
          <PromoCodeField promo={quote?.promo} />
          <CartSummary quote={quote} />
          <Button
            size="L"
            icon={ArrowRight}
            className="fs-cart-panel__cta"
            onClick={() => navigate('/cart')}
            disabled={!quote}
          >
            {quote
              ? t('cart.checkoutWithTotal', { total: money(quote.total) })
              : t('common.loading')}
          </Button>
          <p className="fs-cart-panel__note">
            <Shield size={14} aria-hidden="true" />
            {t('cart.readyIn', { minutes: store?.waitMinutes ?? 15 })}
          </p>
        </>
      )}
    </aside>
  )
}
