import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import type { DragEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLanguage } from '../../app/providers/LanguageProvider'
import { useToast } from '../../app/providers/ToastProvider'
import {
  Badge,
  Button,
  ChevronLeft,
  ErrorBanner,
  Input,
  Plus,
  ProductCard,
  SegmentedControl,
  Select,
  Skeleton,
  Textarea,
  Toggle,
  Trash,
} from '../../design-system'
import { api } from '../../lib/api/endpoints'
import type { AdminProduct } from '../../lib/api/types'
import { apiErrorMessage } from '../shared/helpers'
import { useMoney } from '../shared/queries'
import { productState } from './ProductsPage'
import {
  DESCRIPTION_LIMIT,
  EMPTY_DRAFT,
  IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  margin,
  toDraft,
  toInput,
  validateDraft,
} from './productForm'
import type { DraftErrors, ProductDraft } from './productForm'
import './admin.css'
import './ProductEditorPage.css'

const CATEGORIES = [
  { id: 1, slug: 'burgers' },
  { id: 2, slug: 'burritos' },
  { id: 3, slug: 'sides' },
  { id: 4, slug: 'beverages' },
]

/** Routes /admin/products/new and /admin/products/:id. */
export function ProductEditorPage() {
  const { id } = useParams()
  const isNew = id === 'new'
  const productId = Number(id)
  const { t } = useTranslation()

  const { data, isError, error, refetch } = useQuery({
    queryKey: ['admin-product', productId],
    queryFn: () => api.adminProduct(productId),
    enabled: !isNew && Number.isFinite(productId),
  })

  if (!isNew && isError) {
    return (
      <ErrorBanner
        message={apiErrorMessage(error, t)}
        retryLabel={t('common.retry')}
        onRetry={() => void refetch()}
      />
    )
  }
  if (!isNew && !data) return <Skeleton style={{ height: 480 }} />

  // Remount when the loaded product changes so the draft always starts from the server copy.
  return <Editor key={data?.id ?? 'new'} product={data ?? null} />
}

function Editor({ product }: { product: AdminProduct | null }) {
  const { t } = useTranslation()
  const { language } = useLanguage()
  const money = useMoney()
  const toast = useToast()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const initial: ProductDraft = product ? toDraft(product) : EMPTY_DRAFT
  const [draft, setDraft] = useState<ProductDraft>(initial)
  const [errors, setErrors] = useState<DraftErrors>({})
  const [editLang, setEditLang] = useState<'en' | 'es'>(language)
  const [image, setImage] = useState(product?.image ?? '')
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [imageError, setImageError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [addId, setAddId] = useState('')
  const objectUrl = useRef<string | null>(null)

  useEffect(
    () => () => {
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current)
    },
    [],
  )

  const { data: ingredientCatalog } = useQuery({
    queryKey: ['admin-ingredients', language],
    queryFn: () => api.adminIngredients(language),
  })

  const dirty = JSON.stringify(draft) !== JSON.stringify(initial) || pendingFile !== null
  const update = <K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }))
  const setText = (field: 'name' | 'description', value: string) =>
    setDraft((current) => ({
      ...current,
      translations: {
        ...current.translations,
        [editLang]: { ...current.translations[editLang], [field]: value },
      },
    }))

  const refreshLists = () => {
    for (const key of ['admin-products', 'admin-product', 'menu', 'product']) {
      void queryClient.invalidateQueries({ queryKey: [key] })
    }
  }

  const upload = useMutation({
    mutationFn: ({ id, file }: { id: number; file: File }) => api.uploadProductImage(id, file),
  })

  const save = useMutation({
    mutationFn: async () => {
      const input = toInput(draft)
      if (product) return api.updateProduct(product.id, input)
      const created = await api.createProduct(input)
      // A new product has no id until it is saved, so its image is uploaded right after.
      if (pendingFile) await upload.mutateAsync({ id: created.id, file: pendingFile })
      return created
    },
    onSuccess: (saved) => {
      toast.show(t('products.editor.saved'))
      refreshLists()
      setPendingFile(null)
      if (!product) navigate(`/admin/products/${saved.id}`, { replace: true })
    },
  })

  const remove = useMutation({
    mutationFn: () => api.deleteProduct(product!.id),
    onSuccess: () => {
      toast.show(t('products.editor.deleted'))
      refreshLists()
      navigate('/admin/products', { replace: true })
    },
    onError: (failure) => toast.show(apiErrorMessage(failure, t)),
  })

  function onSave() {
    const found = validateDraft(draft)
    setErrors(found)
    if (Object.keys(found).length > 0) return
    save.mutate()
  }

  function chooseImage(file: File | undefined) {
    setImageError(null)
    if (!file) return
    if (!IMAGE_TYPES.includes(file.type))
      return setImageError(t('products.editor.errors.imageType'))
    if (file.size > MAX_IMAGE_BYTES) return setImageError(t('products.editor.errors.imageSize'))

    if (product) {
      upload.mutate(
        { id: product.id, file },
        {
          onSuccess: (result) => {
            setImage(result.imageUrl)
            refreshLists()
          },
          onError: (failure) => setImageError(apiErrorMessage(failure, t)),
        },
      )
      return
    }
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current)
    objectUrl.current = URL.createObjectURL(file)
    setImage(objectUrl.current)
    setPendingFile(file)
  }

  function onDrop(event: DragEvent) {
    event.preventDefault()
    chooseImage(event.dataTransfer.files[0])
  }

  const prices = margin(draft.price, draft.cost)
  const text = draft.translations[editLang]
  const state = productState({
    publishStatus: draft.publishStatus,
    stock: draft.stock === '' ? null : Number(draft.stock),
    lowStockThreshold: Number(draft.lowStockThreshold) || 0,
    isAvailable: draft.isAvailable,
  })
  const shown = draft.translations[language]
  const unusedIngredients = (ingredientCatalog ?? []).filter(
    (item) => !draft.ingredients.some((row) => row.ingredientId === item.id),
  )

  return (
    <div className="fs-editor">
      <Link to="/admin/products" className="fs-editor__back">
        <ChevronLeft size={16} aria-hidden="true" />
        {t('products.title')}
      </Link>

      <header className="fs-editor__head">
        <h1 className="t-h1">
          {shown.name.trim() || t('products.editor.newTitle')}{' '}
          <Badge tone={state.tone}>{t(`products.state.${state.key}`)}</Badge>
        </h1>
        <div>
          {product && (
            <>
              {confirmDelete ? (
                <span
                  className="fs-editor__confirm"
                  role="group"
                  aria-label={t('products.editor.delete')}
                >
                  {t('products.editor.confirmDelete')}
                  <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
                    {t('adminOrders.back')}
                  </Button>
                  <Button
                    variant="dark"
                    disabled={remove.isPending}
                    onClick={() => remove.mutate()}
                  >
                    {t('products.editor.delete')}
                  </Button>
                </span>
              ) : (
                <Button variant="ghost" onClick={() => setConfirmDelete(true)}>
                  {t('products.editor.delete')}
                </Button>
              )}
              <a
                href={`/menu/${product.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="fs-editor__preview"
              >
                {t('products.editor.preview')}
              </a>
            </>
          )}
          <Button
            variant="ghost"
            disabled={!dirty}
            onClick={() => {
              setDraft(initial)
              setErrors({})
              setPendingFile(null)
              setImage(product?.image ?? '')
            }}
          >
            {t('products.editor.discard')}
          </Button>
          <Button disabled={save.isPending || (!!product && !dirty)} onClick={onSave}>
            {save.isPending ? t('products.editor.saving') : t('products.editor.save')}
          </Button>
        </div>
      </header>

      {save.isError && <ErrorBanner message={apiErrorMessage(save.error, t)} />}
      {Object.keys(errors).length > 0 && <ErrorBanner message={t('products.editor.fixErrors')} />}

      <div className="fs-editor__layout">
        <div className="fs-editor__main">
          <section className="fs-editor__card" aria-labelledby="general-title">
            <div className="fs-editor__card-head">
              <div>
                <h2 id="general-title" className="t-h4">
                  {t('products.editor.general')}
                </h2>
                <p>{t('products.editor.generalHint')}</p>
              </div>
              <SegmentedControl<'en' | 'es'>
                ariaLabel={t('language.label')}
                value={editLang}
                onChange={setEditLang}
                options={[
                  { value: 'en', label: 'EN' },
                  { value: 'es', label: 'ES' },
                ]}
              />
            </div>
            <Input
              label={t('products.editor.name')}
              value={text.name}
              error={
                errors[editLang === 'en' ? 'nameEn' : 'nameEs'] &&
                t(errors[editLang === 'en' ? 'nameEn' : 'nameEs']!)
              }
              onChange={(event) => setText('name', event.target.value)}
            />
            <div>
              <Textarea
                label={t('products.editor.description')}
                value={text.description}
                onChange={(event) => setText('description', event.target.value)}
              />
              <p
                className={
                  text.description.length > DESCRIPTION_LIMIT
                    ? 'fs-editor__counter fs-editor__counter--over'
                    : 'fs-editor__counter'
                }
              >
                {t('products.editor.characters', {
                  count: text.description.length,
                  max: DESCRIPTION_LIMIT,
                })}
              </p>
            </div>
            <div className="fs-editor__row">
              <Select
                label={t('products.editor.category')}
                value={draft.categoryId}
                onChange={(event) => update('categoryId', Number(event.target.value))}
              >
                {CATEGORIES.map((category) => (
                  <option key={category.id} value={category.id}>
                    {t(`products.categories.${category.slug}`)}
                  </option>
                ))}
              </Select>
              <div className="fs-editor__prep">
                <Input
                  label={t('products.editor.prepMin')}
                  inputMode="numeric"
                  value={draft.prepTimeMin}
                  error={errors.prep && t(errors.prep)}
                  onChange={(event) => update('prepTimeMin', event.target.value)}
                />
                <Input
                  label={t('products.editor.prepMax')}
                  inputMode="numeric"
                  value={draft.prepTimeMax}
                  onChange={(event) => update('prepTimeMax', event.target.value)}
                />
              </div>
            </div>
          </section>

          <section className="fs-editor__card" aria-labelledby="pricing-title">
            <h2 id="pricing-title" className="t-h4">
              {t('products.editor.pricing')}
            </h2>
            <div className="fs-editor__row fs-editor__row--4">
              <Input
                label={t('products.editor.price')}
                inputMode="decimal"
                value={draft.price}
                error={errors.price && t(errors.price)}
                onChange={(event) => update('price', event.target.value)}
              />
              <div>
                <Input
                  label={t('products.editor.cost')}
                  inputMode="decimal"
                  value={draft.cost}
                  error={errors.cost && t(errors.cost)}
                  onChange={(event) => update('cost', event.target.value)}
                />
                {prices && (
                  <p className="fs-editor__hint">
                    {t('products.editor.margin', {
                      percent: prices.percent,
                      profit: money(prices.profit),
                    })}
                  </p>
                )}
              </div>
              <div>
                <Input
                  label={t('products.editor.stock')}
                  inputMode="numeric"
                  value={draft.stock}
                  placeholder={t('products.untracked')}
                  error={errors.stock && t(errors.stock)}
                  onChange={(event) => update('stock', event.target.value)}
                />
              </div>
              <Input
                label={t('products.editor.lowStock')}
                inputMode="numeric"
                value={draft.lowStockThreshold}
                error={errors.lowStock && t(errors.lowStock)}
                onChange={(event) => update('lowStockThreshold', event.target.value)}
              />
            </div>
          </section>

          <section className="fs-editor__card" aria-labelledby="ingredients-title">
            <div>
              <h2 id="ingredients-title" className="t-h4">
                {t('products.editor.ingredients')}
              </h2>
              <p className="fs-editor__sub">{t('products.editor.ingredientsHint')}</p>
            </div>
            {errors.ingredients && <ErrorBanner message={t(errors.ingredients)} />}
            {draft.ingredients.length > 0 && (
              <div className="fs-table-wrap">
                <table className="fs-table fs-editor__ingredients">
                  <thead>
                    <tr>
                      <th scope="col">{t('products.editor.ingredient')}</th>
                      <th scope="col">{t('products.editor.included')}</th>
                      <th scope="col">{t('products.editor.max')}</th>
                      <th scope="col">{t('products.editor.extraPrice')}</th>
                      <th scope="col">{t('products.editor.removable')}</th>
                      <th scope="col">
                        <span className="sr-only">{t('products.cols.actions')}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {draft.ingredients.map((row, index) => {
                      const name =
                        ingredientCatalog?.find((item) => item.id === row.ingredientId)?.name ??
                        row.name
                      const patch = (changes: Partial<typeof row>) =>
                        update(
                          'ingredients',
                          draft.ingredients.map((r, i) => (i === index ? { ...r, ...changes } : r)),
                        )
                      return (
                        <tr key={row.id ?? `new-${row.ingredientId}`}>
                          <td>{name}</td>
                          <td>
                            <input
                              type="number"
                              min={0}
                              value={row.default}
                              aria-label={t('products.editor.includedFor', { name })}
                              onChange={(event) => patch({ default: Number(event.target.value) })}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min={1}
                              value={row.max}
                              aria-label={t('products.editor.maxFor', { name })}
                              onChange={(event) => patch({ max: Number(event.target.value) })}
                            />
                          </td>
                          <td>
                            <input
                              inputMode="decimal"
                              value={row.extraPrice}
                              aria-label={t('products.editor.extraFor', { name })}
                              onChange={(event) => patch({ extraPrice: event.target.value })}
                            />
                          </td>
                          <td>
                            <Toggle
                              checked={row.removable}
                              label={t('products.editor.removableFor', { name })}
                              onChange={(value) => patch({ removable: value })}
                            />
                          </td>
                          <td>
                            <button
                              type="button"
                              className="fs-editor__trash"
                              aria-label={t('products.editor.removeIngredient', { name })}
                              onClick={() =>
                                update(
                                  'ingredients',
                                  draft.ingredients.filter((_, i) => i !== index),
                                )
                              }
                            >
                              <Trash size={16} aria-hidden="true" />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {unusedIngredients.length > 0 && (
              <div className="fs-editor__add">
                <Select
                  label={t('products.editor.addIngredient')}
                  value={addId}
                  onChange={(event) => setAddId(event.target.value)}
                >
                  <option value="">{t('products.editor.chooseIngredient')}</option>
                  {unusedIngredients.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </Select>
                <Button
                  variant="secondary"
                  icon={Plus}
                  disabled={!addId}
                  onClick={() => {
                    const item = unusedIngredients.find((i) => String(i.id) === addId)
                    if (!item) return
                    update('ingredients', [
                      ...draft.ingredients,
                      {
                        ingredientId: item.id,
                        name: item.name,
                        default: 0,
                        max: 1,
                        extraPrice: '0.00',
                        removable: true,
                      },
                    ])
                    setAddId('')
                  }}
                >
                  {t('products.editor.add')}
                </Button>
              </div>
            )}
          </section>
        </div>

        <aside className="fs-editor__side">
          <section className="fs-editor__card" aria-labelledby="image-title">
            <div>
              <h2 id="image-title" className="t-h4">
                {t('products.editor.image')}
              </h2>
              <p className="fs-editor__sub">{t('products.editor.imageHint')}</p>
            </div>
            {image && <img className="fs-editor__image" src={image} alt={shown.name} />}
            <label
              className="fs-editor__drop"
              onDragOver={(event) => event.preventDefault()}
              onDrop={onDrop}
            >
              <input
                type="file"
                accept="image/png,image/jpeg"
                className="sr-only"
                onChange={(event) => chooseImage(event.target.files?.[0])}
              />
              <Plus size={18} aria-hidden="true" />
              <strong>
                {upload.isPending ? t('products.editor.uploading') : t('products.editor.drop')}
              </strong>
              {pendingFile && (
                <small>{t('products.editor.uploadOnSave', { name: pendingFile.name })}</small>
              )}
            </label>
            {imageError && <ErrorBanner message={imageError} />}
          </section>

          <section className="fs-editor__card" aria-labelledby="visibility-title">
            <h2 id="visibility-title" className="t-h4">
              {t('products.editor.visibility')}
            </h2>
            {(
              [
                ['isAvailable', 'available'],
                ['isFeatured', 'featured'],
                ['allowCustomization', 'customization'],
              ] as const
            ).map(([field, key]) => (
              <div key={field} className="fs-editor__switch">
                <div>
                  <strong>{t(`products.editor.${key}`)}</strong>
                  <small>{t(`products.editor.${key}Hint`)}</small>
                </div>
                <Toggle
                  checked={draft[field]}
                  label={t(`products.editor.${key}`)}
                  onChange={(value) => update(field, value)}
                />
              </div>
            ))}
            <div className="fs-editor__switch">
              <div>
                <strong>{t('products.editor.published')}</strong>
                <small>{t('products.editor.publishedHint')}</small>
              </div>
              <Toggle
                checked={draft.publishStatus === 'active'}
                label={t('products.editor.published')}
                onChange={(value) => update('publishStatus', value ? 'active' : 'draft')}
              />
            </div>
          </section>

          <section className="fs-editor__card" aria-labelledby="preview-title">
            <h2 id="preview-title" className="t-h4">
              {t('products.editor.menuPreview')}
            </h2>
            <ProductCard
              name={shown.name || t('products.editor.newTitle')}
              description={shown.description}
              price={prices ? money(draft.price) : money(0)}
              meta={`${draft.prepTimeMin}–${draft.prepTimeMax} min${draft.calories ? ` · ${draft.calories} kcal` : ''}`}
              image={image || '/menu/overkill-double.jpg'}
              addLabel={t('common.addToCart')}
              disabled
            />
          </section>
        </aside>
      </div>
    </div>
  )
}
