import { Plus, Star } from '../icons'
import './ProductCard.css'

type ProductCardProps = {
  name: string
  description: string
  /** Already formatted for the active locale (see lib/format.ts). */
  price: string
  /** Small caption under the price, e.g. "620 kcal". */
  meta?: string
  rating?: string
  image: string
  /** Accessible name for the add button; pass a translated string. */
  addLabel: string
  onAdd?: () => void
  /** Disables the add button (out of stock, store closed…). */
  disabled?: boolean
  onSelect?: () => void
  className?: string
}

export function ProductCard({
  name,
  description,
  price,
  meta,
  rating,
  image,
  addLabel,
  onAdd,
  disabled,
  onSelect,
  className,
}: ProductCardProps) {
  return (
    <article className={['fs-product-card', className].filter(Boolean).join(' ')}>
      <div
        className="fs-product-card__image"
        style={{ backgroundImage: `url(${image})` }}
        onClick={onSelect}
        aria-hidden="true"
      >
        {rating && (
          <span className="fs-product-card__tag">
            <Star size={12} aria-hidden="true" />
            {rating}
          </span>
        )}
      </div>
      <div className="fs-product-card__body">
        <h3 className="fs-product-card__name">
          {onSelect ? (
            <button type="button" className="fs-product-card__name-btn" onClick={onSelect}>
              {name}
            </button>
          ) : (
            name
          )}
        </h3>
        <p className="fs-product-card__description">{description}</p>
        <div className="fs-product-card__footer">
          <div className="fs-product-card__price-group">
            <span className="fs-product-card__price">{price}</span>
            {meta && <span className="fs-product-card__meta">{meta}</span>}
          </div>
          <button
            type="button"
            className="fs-product-card__add"
            aria-label={addLabel}
            disabled={disabled}
            onClick={onAdd}
          >
            <Plus size={20} aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  )
}
