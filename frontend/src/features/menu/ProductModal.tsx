import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useToast } from '../../app/providers/ToastProvider'
import {
  Button,
  Checkbox,
  Clock,
  ErrorBanner,
  Modal,
  Skeleton,
  Stepper,
  Textarea,
  Utensils,
  X,
} from '../../design-system'
import type { ProductDetail } from '../../lib/api/types'
import { MAX_LINE_QUANTITY, cartItemKey, useCartStore } from '../cart/cartStore'
import type { CartIngredient } from '../cart/cartStore'
import { apiErrorMessage } from '../shared/helpers'
import { useMoney, useProduct, useQuote } from '../shared/queries'
import './ProductModal.css'

/** Quantities keyed by productIngredientId; absent = the default recipe. */
type Quantities = Record<number, number>

function changedIngredients(product: ProductDetail, quantities: Quantities): CartIngredient[] {
  return product.ingredients
    .map((ingredient) => ({
      productIngredientId: ingredient.productIngredientId,
      name: ingredient.name,
      default: ingredient.default,
      quantity: quantities[ingredient.productIngredientId] ?? ingredient.default,
    }))
    .filter((ingredient) => ingredient.quantity !== ingredient.default)
}

/** Route /menu/:productId — customization modal over the menu (bottom sheet on mobile). */
export function ProductModal() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const toast = useToast()
  const money = useMoney()
  const { productId } = useParams()
  const [searchParams] = useSearchParams()
  const editKey = searchParams.get('edit')
  const close = () => navigate('/menu')

  const { data: product, isError, error, refetch } = useProduct(Number(productId))

  return (
    <Modal onClose={close} label={product?.name ?? t('pages.product')} className="fs-product-modal">
      {isError ? (
        <div className="fs-product-modal__state">
          <ErrorBanner
            message={apiErrorMessage(error, t)}
            retryLabel={t('common.retry')}
            onRetry={() => void refetch()}
          />
        </div>
      ) : !product ? (
        <div className="fs-product-modal__state">
          <Skeleton style={{ height: 320 }} />
        </div>
      ) : (
        <ProductForm
          // Remount when the product or the edited line changes so state resets cleanly.
          key={`${product.id}-${editKey ?? 'new'}`}
          product={product}
          editKey={editKey}
          money={money}
          onClose={close}
          onDone={(name, edited) => {
            toast.show(t(edited ? 'cart.updated' : 'cart.added', { name }))
            close()
          }}
        />
      )}
    </Modal>
  )
}

type ProductFormProps = {
  product: ProductDetail
  editKey: string | null
  money: (amount: string | number) => string
  onClose: () => void
  onDone: (name: string, edited: boolean) => void
}

function ProductForm({ product, editKey, money, onClose, onDone }: ProductFormProps) {
  const { t } = useTranslation()
  const items = useCartStore((s) => s.items)
  const add = useCartStore((s) => s.add)
  const replace = useCartStore((s) => s.replace)
  const editing = editKey ? items.find((item) => item.key === editKey) : undefined

  const [quantities, setQuantities] = useState<Quantities>(() =>
    Object.fromEntries(
      (editing?.ingredients ?? []).map((i) => [i.productIngredientId, i.quantity]),
    ),
  )
  const [notes, setNotes] = useState(editing?.notes ?? '')
  const [quantity, setQuantity] = useState(editing?.quantity ?? 1)

  const ingredients = useMemo(() => changedIngredients(product, quantities), [product, quantities])
  const quote = useQuote({
    items: [
      {
        key: cartItemKey({ productId: product.id, ingredients, notes }),
        productId: product.id,
        name: product.name,
        image: product.image,
        quantity,
        ingredients,
        notes,
      },
    ],
    promoCode: '',
    fulfillmentType: 'pickup',
  })

  const unavailable = !product.isAvailable || product.stock === 0
  const prep =
    product.prepTimeMin && product.prepTimeMax
      ? t('product.prep', { min: product.prepTimeMin, max: product.prepTimeMax })
      : null

  function setIngredient(id: number, next: number) {
    setQuantities((current) => ({ ...current, [id]: next }))
  }

  function submit() {
    const item = {
      productId: product.id,
      name: product.name,
      image: product.image,
      quantity,
      ingredients,
      notes,
    }
    if (editKey && editing) replace(editKey, item)
    else add(item)
    onDone(product.name, Boolean(editKey && editing))
  }

  const lineTotal = quote.data?.lines[0]?.lineTotal

  return (
    <div className="fs-product-modal__body">
      <div className="fs-product-modal__media" style={{ backgroundImage: `url(${product.image})` }}>
        <div className="fs-product-modal__facts">
          {product.calories !== null && (
            <div>
              <strong>{product.calories}</strong>
              <span>{t('product.kcal')}</span>
            </div>
          )}
          {prep && (
            <div>
              <strong>{product.prepTimeMax}m</strong>
              <span>{t('product.prepLabel')}</span>
            </div>
          )}
        </div>
      </div>

      <div className="fs-product-modal__details">
        <header className="fs-product-modal__head">
          <div>
            <span className="t-overline fs-product-modal__category">{product.category.name}</span>
            <h2 className="t-h2">{product.name}</h2>
            {prep && (
              <p className="fs-product-modal__meta">
                <Clock size={16} aria-hidden="true" />
                {prep}
                {product.calories !== null && (
                  <>
                    <span aria-hidden="true">·</span>
                    <Utensils size={16} aria-hidden="true" />
                    {t('product.caloriesValue', { count: product.calories })}
                  </>
                )}
              </p>
            )}
          </div>
          <button
            type="button"
            className="fs-product-modal__close"
            onClick={onClose}
            aria-label={t('common.close')}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <p className="fs-product-modal__description">{product.description}</p>

        {product.allowCustomization && product.ingredients.length > 0 && (
          <section aria-labelledby="customize-heading">
            <div className="fs-product-modal__section-head">
              <h3 id="customize-heading" className="t-h4">
                {t('product.customize')}
              </h3>
            </div>
            <ul className="fs-product-modal__ingredients">
              {product.ingredients.map((ingredient) => {
                const id = ingredient.productIngredientId
                const value = quantities[id] ?? ingredient.default
                const included = value > 0
                const removable = ingredient.removable
                const floor = removable ? 0 : ingredient.default
                const hasPrice = Number(ingredient.extraPrice) > 0
                const hint =
                  value > ingredient.default || (ingredient.default === 0 && hasPrice)
                    ? hasPrice
                      ? ingredient.default === 0 && ingredient.max === 1
                        ? t('product.extraOnce', { price: money(ingredient.extraPrice) })
                        : t('product.extraEach', { price: money(ingredient.extraPrice) })
                      : null
                    : ingredient.default > 0
                      ? t('product.included')
                      : null
                return (
                  <li key={id} className="fs-product-modal__ingredient">
                    <Checkbox
                      checked={included}
                      disabled={!removable && ingredient.default > 0 && ingredient.max === 1}
                      onChange={(event) =>
                        setIngredient(
                          id,
                          event.target.checked ? Math.max(1, ingredient.default) : floor,
                        )
                      }
                    >
                      <span className="fs-product-modal__ingredient-name">{ingredient.name}</span>
                      {hint && (
                        <span
                          className={
                            hasPrice
                              ? 'fs-product-modal__ingredient-hint fs-product-modal__ingredient-hint--price'
                              : 'fs-product-modal__ingredient-hint'
                          }
                        >
                          {hint}
                        </span>
                      )}
                    </Checkbox>
                    {ingredient.max > 1 && included && (
                      <Stepper
                        value={value}
                        min={Math.max(floor, removable ? 0 : ingredient.default)}
                        max={ingredient.max}
                        onChange={(next) => setIngredient(id, next)}
                        decrementLabel={t('product.lessOf', { name: ingredient.name })}
                        incrementLabel={t('product.moreOf', { name: ingredient.name })}
                      />
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {product.allowCustomization && (
          <Textarea
            label={t('product.notes')}
            placeholder={t('product.notesPlaceholder')}
            value={notes}
            maxLength={200}
            onChange={(event) => setNotes(event.target.value)}
          />
        )}

        <footer className="fs-product-modal__footer">
          <Stepper
            value={quantity}
            min={1}
            max={MAX_LINE_QUANTITY}
            onChange={setQuantity}
            decrementLabel={t('common.decrease')}
            incrementLabel={t('common.increase')}
          />
          <Button
            size="L"
            className="fs-product-modal__add"
            disabled={unavailable}
            onClick={submit}
          >
            {unavailable
              ? t('product.outOfStock')
              : t(editing ? 'product.update' : 'product.addToOrder', {
                  total: lineTotal ? money(lineTotal) : money(product.price),
                })}
          </Button>
        </footer>
      </div>
    </div>
  )
}
