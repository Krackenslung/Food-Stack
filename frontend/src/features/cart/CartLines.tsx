import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Edit, Stepper, Trash } from '../../design-system'
import type { QuoteLine } from '../../lib/api/types'
import { describeChanges } from '../shared/helpers'
import { useMoney } from '../shared/queries'
import { MAX_LINE_QUANTITY, useCartStore } from './cartStore'
import type { CartItem } from './cartStore'
import './CartLines.css'

type CartLinesProps = {
  items: CartItem[]
  /** Server-priced lines, same order as items (may be undefined while loading). */
  quoteLines?: QuoteLine[]
  /** Compact rows for the menu side panel. */
  compact?: boolean
}

/** Cart rows with quantity steppers; prices always come from the quote, never computed here. */
export function CartLines({ items, quoteLines, compact }: CartLinesProps) {
  const { t } = useTranslation()
  const money = useMoney()
  const setQuantity = useCartStore((s) => s.setQuantity)
  const remove = useCartStore((s) => s.remove)

  return (
    <ul className={compact ? 'fs-cart-lines fs-cart-lines--compact' : 'fs-cart-lines'}>
      {items.map((item, index) => {
        const changes = describeChanges(item.ingredients, t)
        const line = quoteLines?.[index]
        return (
          <li key={item.key} className="fs-cart-line">
            <img src={item.image} alt="" className="fs-cart-line__image" />
            <div className="fs-cart-line__info">
              <span className="fs-cart-line__name">{item.name}</span>
              {changes.length > 0 && (
                <span className="fs-cart-line__changes">{changes.join(' · ')}</span>
              )}
              {item.notes && <span className="fs-cart-line__changes">“{item.notes}”</span>}
              {compact && (
                <span className="fs-cart-line__price">{line ? money(line.lineTotal) : '—'}</span>
              )}
              {!compact && (
                <span className="fs-cart-line__actions">
                  <Link to={`/menu/${item.productId}?edit=${encodeURIComponent(item.key)}`}>
                    <Edit size={14} aria-hidden="true" />
                    {t('cart.edit')}
                    <span className="sr-only"> {item.name}</span>
                  </Link>
                  <button
                    type="button"
                    className="fs-cart-line__remove"
                    onClick={() => remove(item.key)}
                  >
                    <Trash size={14} aria-hidden="true" />
                    {t('cart.remove')}
                    <span className="sr-only"> {item.name}</span>
                  </button>
                </span>
              )}
            </div>
            <Stepper
              value={item.quantity}
              min={1}
              max={MAX_LINE_QUANTITY}
              onChange={(next) => setQuantity(item.key, next)}
              decrementLabel={t('common.decrease')}
              incrementLabel={t('common.increase')}
            />
            {!compact && (
              <span className="fs-cart-line__price fs-cart-line__price--wide">
                {line ? money(line.lineTotal) : '—'}
              </span>
            )}
          </li>
        )
      })}
    </ul>
  )
}
