import { useTranslation } from 'react-i18next'
import type { Quote } from '../../lib/api/types'
import { useMoney, useStoreInfo } from '../shared/queries'
import './CartSummary.css'

type CartSummaryProps = {
  quote: Quote | undefined
  /** Number shown in "Subtotal (4 items)". */
  itemCount?: number
  /** Heading of the final row. */
  totalLabel?: string
}

/** Subtotal / discount / fees / tax / total rows, all straight from the server quote. */
export function CartSummary({ quote, itemCount, totalLabel }: CartSummaryProps) {
  const { t } = useTranslation()
  const money = useMoney()
  const { data: store } = useStoreInfo()

  if (!quote) return null
  const hasDiscount = Number(quote.discount) > 0
  const hasDelivery = Number(quote.deliveryFee) > 0
  void store

  return (
    <div className="fs-summary">
      <dl className="fs-summary__rows">
        <div>
          <dt>
            {itemCount === undefined
              ? t('summary.subtotal')
              : t('summary.subtotalItems', { count: itemCount })}
          </dt>
          <dd>{money(quote.subtotal)}</dd>
        </div>
        {hasDiscount && (
          <div className="fs-summary__discount">
            <dt>{t('summary.discount')}</dt>
            <dd>−{money(quote.discount)}</dd>
          </div>
        )}
        <div>
          <dt>{t('summary.serviceFee')}</dt>
          <dd>{money(quote.serviceFee)}</dd>
        </div>
        {hasDelivery && (
          <div>
            <dt>{t('summary.deliveryFee')}</dt>
            <dd>{money(quote.deliveryFee)}</dd>
          </div>
        )}
        <div>
          <dt>{t('summary.tax')}</dt>
          <dd>{money(quote.tax)}</dd>
        </div>
      </dl>
      <div className="fs-summary__total">
        <span>{totalLabel ?? t('summary.total')}</span>
        <span>{money(quote.total)}</span>
      </div>
    </div>
  )
}
