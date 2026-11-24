import { useTranslation } from 'react-i18next'
import { Badge, ORDER_STATUS_TONE } from '../../design-system'
import type { OrderStatus } from '../../lib/api/types'

export function StatusBadge({ status }: { status: OrderStatus }) {
  const { t } = useTranslation()
  return <Badge tone={ORDER_STATUS_TONE[status] ?? 'neutral'}>{t(`orders.status.${status}`)}</Badge>
}
