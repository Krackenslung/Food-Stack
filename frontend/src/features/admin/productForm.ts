import type { AdminProduct, AdminProductInput, AdminProductIngredient } from '../../lib/api/types'

/** The editor keeps numbers as strings while typing; this is the draft it works on. */
export type ProductDraft = {
  categoryId: number
  price: string
  cost: string
  stock: string // '' = not tracked
  lowStockThreshold: string
  prepTimeMin: string
  prepTimeMax: string
  calories: string
  isAvailable: boolean
  isFeatured: boolean
  allowCustomization: boolean
  publishStatus: 'active' | 'draft'
  translations: AdminProductInput['translations']
  ingredients: AdminProductIngredient[]
}

export const DESCRIPTION_LIMIT = 240

export const EMPTY_DRAFT: ProductDraft = {
  categoryId: 1,
  price: '',
  cost: '',
  stock: '',
  lowStockThreshold: '10',
  prepTimeMin: '10',
  prepTimeMax: '15',
  calories: '',
  isAvailable: false,
  isFeatured: false,
  allowCustomization: true,
  publishStatus: 'draft',
  translations: { en: { name: '', description: '' }, es: { name: '', description: '' } },
  ingredients: [],
}

export function toDraft(product: AdminProduct): ProductDraft {
  return {
    categoryId: product.categoryId,
    price: product.price,
    cost: product.cost,
    stock: product.stock === null ? '' : String(product.stock),
    lowStockThreshold: String(product.lowStockThreshold),
    prepTimeMin: String(product.prepTimeMin),
    prepTimeMax: String(product.prepTimeMax),
    calories: product.calories === null ? '' : String(product.calories),
    isAvailable: product.isAvailable,
    isFeatured: product.isFeatured,
    allowCustomization: product.allowCustomization,
    publishStatus: product.publishStatus,
    translations: structuredClone(product.translations),
    ingredients: structuredClone(product.ingredients),
  }
}

const MONEY = /^\d+(\.\d{1,2})?$/
const WHOLE = /^\d+$/

export type DraftErrors = Partial<
  Record<
    | 'nameEn'
    | 'nameEs'
    | 'descriptionEn'
    | 'descriptionEs'
    | 'price'
    | 'cost'
    | 'stock'
    | 'lowStock'
    | 'prep'
    | 'ingredients',
    string
  >
>

/** Returns i18n keys per invalid field (empty object = valid). The API validates again. */
export function validateDraft(draft: ProductDraft): DraftErrors {
  const errors: DraftErrors = {}
  if (!draft.translations.en.name.trim()) errors.nameEn = 'products.editor.errors.name'
  if (!draft.translations.es.name.trim()) errors.nameEs = 'products.editor.errors.name'
  if (draft.translations.en.description.length > DESCRIPTION_LIMIT) {
    errors.descriptionEn = 'products.editor.errors.description'
  }
  if (draft.translations.es.description.length > DESCRIPTION_LIMIT) {
    errors.descriptionEs = 'products.editor.errors.description'
  }
  if (!MONEY.test(draft.price) || Number(draft.price) <= 0)
    errors.price = 'products.editor.errors.price'
  if (!MONEY.test(draft.cost)) errors.cost = 'products.editor.errors.cost'
  if (draft.stock !== '' && !WHOLE.test(draft.stock)) errors.stock = 'products.editor.errors.stock'
  if (!WHOLE.test(draft.lowStockThreshold)) errors.lowStock = 'products.editor.errors.stock'
  if (
    !WHOLE.test(draft.prepTimeMin) ||
    !WHOLE.test(draft.prepTimeMax) ||
    Number(draft.prepTimeMin) > Number(draft.prepTimeMax)
  ) {
    errors.prep = 'products.editor.errors.prep'
  }
  if (
    draft.ingredients.some(
      (row) =>
        row.default < 0 || row.max < 1 || row.default > row.max || !MONEY.test(row.extraPrice),
    )
  ) {
    errors.ingredients = 'products.editor.errors.ingredients'
  }
  return errors
}

export function toInput(draft: ProductDraft): AdminProductInput {
  return {
    categoryId: draft.categoryId,
    price: Number(draft.price).toFixed(2),
    cost: Number(draft.cost || '0').toFixed(2),
    stock: draft.stock === '' ? null : Number(draft.stock),
    lowStockThreshold: Number(draft.lowStockThreshold),
    prepTimeMin: Number(draft.prepTimeMin),
    prepTimeMax: Number(draft.prepTimeMax),
    calories: draft.calories === '' ? null : Number(draft.calories),
    isAvailable: draft.isAvailable,
    isFeatured: draft.isFeatured,
    allowCustomization: draft.allowCustomization,
    publishStatus: draft.publishStatus,
    translations: draft.translations,
    ingredients: draft.ingredients,
  }
}

/** Margin for the editor's hint: (price - cost) / price. Display only, never used for orders. */
export function margin(price: string, cost: string): { percent: number; profit: number } | null {
  const p = Number(price)
  const c = Number(cost || '0')
  if (!MONEY.test(price) || p <= 0 || Number.isNaN(c)) return null
  return { percent: Math.round(((p - c) / p) * 100), profit: p - c }
}

export const IMAGE_TYPES = ['image/png', 'image/jpeg']
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
