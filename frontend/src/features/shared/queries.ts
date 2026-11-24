import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useLanguage } from '../../app/providers/LanguageProvider'
import { api } from '../../lib/api/endpoints'
import type { FulfillmentType } from '../../lib/api/types'
import { formatMoney } from '../../lib/format'
import { toLineInputs } from '../cart/cartStore'
import type { CartItem } from '../cart/cartStore'

export function useStoreInfo() {
  return useQuery({ queryKey: ['store'], queryFn: api.store, staleTime: 60_000 })
}

export function useMenu() {
  const { language } = useLanguage()
  return useQuery({ queryKey: ['menu', language], queryFn: () => api.menu(language) })
}

export function useProduct(id: number | null) {
  const { language } = useLanguage()
  return useQuery({
    queryKey: ['product', id, language],
    queryFn: () => api.product(id as number, language),
    enabled: id !== null && Number.isFinite(id),
  })
}

export function useQuote(args: {
  items: CartItem[]
  promoCode: string
  fulfillmentType: FulfillmentType
}) {
  const { items, promoCode, fulfillmentType } = args
  const payload = {
    items: toLineInputs(items),
    promoCode: promoCode.trim() || undefined,
    fulfillmentType,
  }
  return useQuery({
    queryKey: ['quote', payload],
    queryFn: () => api.quote(payload),
    enabled: items.length > 0,
    placeholderData: keepPreviousData,
    retry: false,
  })
}

/** Money formatter bound to the active language and the store currency. */
export function useMoney() {
  const { language } = useLanguage()
  const { data: store } = useStoreInfo()
  const currency = store?.currency ?? 'USD'
  return (amount: number | string) => formatMoney(amount, language, currency)
}
