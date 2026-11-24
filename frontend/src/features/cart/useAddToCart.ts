import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useToast } from '../../app/providers/ToastProvider'
import type { MenuProduct } from '../../lib/api/types'
import { useCartStore } from './cartStore'

/** Quick add with the default recipe; also confirms with a toast. */
export function useAddToCart() {
  const { t } = useTranslation()
  const toast = useToast()
  const add = useCartStore((s) => s.add)

  return useCallback(
    (product: Pick<MenuProduct, 'id' | 'name' | 'image'>) => {
      add({
        productId: product.id,
        name: product.name,
        image: product.image,
        quantity: 1,
        ingredients: [],
        notes: '',
      })
      toast.show(t('cart.added', { name: product.name }))
    },
    [add, t, toast],
  )
}
