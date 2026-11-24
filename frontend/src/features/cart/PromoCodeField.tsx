import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Receipt } from '../../design-system'
import type { PromoResult } from '../../lib/api/types'
import { useCartStore } from './cartStore'
import './PromoCodeField.css'

/** Promo entry; validity comes back from the quote (PromoResult), never decided on the client. */
export function PromoCodeField({ promo }: { promo: PromoResult | null | undefined }) {
  const { t } = useTranslation()
  const applied = useCartStore((s) => s.promoCode)
  const setPromoCode = useCartStore((s) => s.setPromoCode)
  const [draft, setDraft] = useState(applied)

  const appliedValid = promo?.valid === true
  const invalidReason = promo && !promo.valid ? promo.reason : null

  return (
    <div className="fs-promo">
      <form
        className="fs-promo__field"
        onSubmit={(event) => {
          event.preventDefault()
          setPromoCode(appliedValid ? '' : draft.trim().toUpperCase())
          if (appliedValid) setDraft('')
        }}
      >
        <Receipt size={18} aria-hidden="true" />
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={t('cart.promoPlaceholder')}
          aria-label={t('cart.promoPlaceholder')}
          readOnly={appliedValid}
        />
        <button type="submit">{appliedValid ? t('cart.promoRemove') : t('cart.promoApply')}</button>
      </form>
      {appliedValid && (
        <p className="fs-promo__ok" role="status">
          {t('cart.promoApplied', { code: promo.code })}
        </p>
      )}
      {invalidReason && (
        <p className="fs-promo__error" role="alert">
          {t(`promo.${invalidReason}`, { defaultValue: t('promo.default') })}
        </p>
      )}
    </div>
  )
}
