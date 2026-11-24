import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLanguage } from '../../app/providers/LanguageProvider'
import { useToast } from '../../app/providers/ToastProvider'
import {
  ArrowRight,
  Bell,
  Button,
  Clock,
  ErrorBanner,
  Flame,
  Home,
  Skeleton,
  Truck,
} from '../../design-system'
import { api } from '../../lib/api/endpoints'
import type { KitchenBoard, KitchenStatus, KitchenTicket, OrderStatus } from '../../lib/api/types'
import { useNow } from '../../lib/useNow'
import { apiErrorMessage, describeChanges } from '../shared/helpers'
import { actionFor, formatTimer, minutesOverTarget, NEXT_STATUS, shortName } from './kitchen'
import type { KitchenAction } from './kitchen'
import { useKitchenSound } from './useKitchenSound'
import './KitchenPage.css'

const COLUMNS: KitchenStatus[] = ['received', 'preparing', 'ready', 'completed']
const POLL_MS = 10_000

/** Shared with the admin sidebar badge so both use one polled request. */
export function useKitchenBoard() {
  return useQuery({
    queryKey: ['kitchen'],
    queryFn: api.kitchen,
    refetchInterval: POLL_MS,
  })
}

export function KitchenPage() {
  const { t } = useTranslation()
  const toast = useToast()
  const queryClient = useQueryClient()
  const { language } = useLanguage()
  const { data, isError, error, refetch } = useKitchenBoard()
  const sound = useKitchenSound()
  const now = useNow(1000)

  // Tickets that appeared since the last poll pulse once and play the chime.
  const seen = useRef<Set<number> | null>(null)
  const [fresh, setFresh] = useState<Set<number>>(new Set())
  const { chime } = sound
  useEffect(() => {
    if (!data) return
    const ids = new Set(data.columns.received.map((ticket) => ticket.id))
    if (seen.current) {
      const added = [...ids].filter((id) => !seen.current!.has(id))
      if (added.length > 0) {
        setFresh(new Set(added))
        chime()
        const timer = setTimeout(() => setFresh(new Set()), 3000)
        seen.current = ids
        return () => clearTimeout(timer)
      }
    }
    seen.current = ids
  }, [data, chime])

  const move = useMutation({
    mutationFn: ({ id, status }: { id: number; status: OrderStatus }) =>
      api.setOrderStatus(id, status),
    // Optimistic: the ticket slides to its new column immediately; a failure restores the board.
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ['kitchen'] })
      const previous = queryClient.getQueryData<KitchenBoard>(['kitchen'])
      if (previous) {
        const columns = { ...previous.columns }
        let moved: KitchenTicket | undefined
        for (const key of COLUMNS) {
          const found = columns[key].find((ticket) => ticket.id === id)
          if (found) {
            moved = found
            columns[key] = columns[key].filter((ticket) => ticket.id !== id)
          }
        }
        if (moved && (status === 'preparing' || status === 'ready' || status === 'completed')) {
          columns[status] = [
            ...columns[status],
            { ...moved, status, statusSince: new Date().toISOString() },
          ]
        }
        queryClient.setQueryData<KitchenBoard>(['kitchen'], { ...previous, columns })
      }
      return { previous }
    },
    onError: (failure, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(['kitchen'], context.previous)
      toast.show(apiErrorMessage(failure, t))
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['kitchen'] })
      void queryClient.invalidateQueries({ queryKey: ['admin-orders'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })

  return (
    <MotionConfig reducedMotion="user">
      <div className="fs-kitchen">
        <header className="fs-kitchen__head">
          <div>
            <h1 className="t-h1">{t('pages.kitchen')}</h1>
            <p className="t-body-s">{t('kitchen.subtitle')}</p>
          </div>
          <div className="fs-kitchen__stats">
            <span className="fs-kitchen__stat">
              <strong>{data?.stats.active ?? '–'}</strong> {t('kitchen.active')}
            </span>
            <span className="fs-kitchen__stat">
              <strong>{data ? formatTimer(data.stats.avgPrepSeconds) : '–'}</strong>{' '}
              {t('kitchen.avgPrep')}
            </span>
            <span
              className={
                data && data.stats.delayed > 0
                  ? 'fs-kitchen__stat fs-kitchen__stat--alert'
                  : 'fs-kitchen__stat'
              }
            >
              <strong>{data?.stats.delayed ?? '–'}</strong> {t('kitchen.delayed')}
            </span>
            <Button variant="dark" icon={Bell} aria-pressed={sound.enabled} onClick={sound.toggle}>
              {sound.enabled ? t('kitchen.soundOn') : t('kitchen.soundOff')}
            </Button>
          </div>
        </header>

        {isError && (
          <ErrorBanner
            message={apiErrorMessage(error, t)}
            retryLabel={t('common.retry')}
            onRetry={() => void refetch()}
          />
        )}

        <div className="fs-kitchen__board">
          {COLUMNS.map((status) => {
            const tickets = data?.columns[status]
            return (
              <section
                key={status}
                className={`fs-kitchen__column fs-kitchen__column--${status}`}
                aria-labelledby={`col-${status}`}
              >
                <h2 id={`col-${status}`} className="fs-kitchen__column-head">
                  <span aria-hidden="true" />
                  {t(`kitchen.columns.${status}`)}
                  <small>{tickets?.length ?? 0}</small>
                </h2>
                {!tickets ? (
                  <Skeleton style={{ height: 160, borderRadius: 16 }} />
                ) : tickets.length === 0 ? (
                  <p className="fs-kitchen__empty">{t('kitchen.empty')}</p>
                ) : (
                  <ul>
                    <AnimatePresence initial={false}>
                      {tickets.map((ticket) => (
                        <Ticket
                          key={ticket.id}
                          ticket={ticket}
                          now={now}
                          isNew={fresh.has(ticket.id)}
                          language={language}
                          busy={move.isPending && move.variables?.id === ticket.id}
                          onAdvance={() => {
                            if (ticket.status !== 'completed') {
                              move.mutate({ id: ticket.id, status: NEXT_STATUS[ticket.status] })
                            }
                          }}
                        />
                      ))}
                    </AnimatePresence>
                  </ul>
                )}
              </section>
            )
          })}
        </div>
      </div>
    </MotionConfig>
  )
}

type TicketProps = {
  ticket: KitchenTicket
  now: number
  isNew: boolean
  language: 'en' | 'es'
  busy: boolean
  onAdvance: () => void
}

const ACTION_VARIANT: Record<KitchenAction, 'dark' | 'primary' | 'secondary'> = {
  accept: 'dark',
  markReady: 'primary',
  pickedUp: 'secondary',
  handToRider: 'secondary',
}

function Ticket({ ticket, now, isNew, language, busy, onAdvance }: TicketProps) {
  const { t } = useTranslation()
  const action = actionFor(ticket)
  const completed = ticket.status === 'completed'
  const over = ticket.delayed ? minutesOverTarget(ticket, now) : 0
  const FulfillmentIcon = ticket.fulfillmentType === 'delivery' ? Truck : Home

  const timer = completed
    ? new Date(ticket.statusSince).toLocaleTimeString(language === 'es' ? 'es-MX' : 'en-US', {
        hour: 'numeric',
        minute: '2-digit',
      })
    : formatTimer((now - Date.parse(ticket.statusSince)) / 1000)

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
      className={[
        'fs-ticket',
        ticket.delayed && 'fs-ticket--delayed',
        isNew && 'fs-ticket--new',
        completed && 'fs-ticket--done',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <header>
        <div>
          <strong>#{ticket.orderNumber}</strong>
          <span>
            <FulfillmentIcon size={14} aria-hidden="true" />
            {t(`cart.${ticket.fulfillmentType}`)} · {shortName(ticket.customerName)}
          </span>
        </div>
        <span
          className={`fs-ticket__timer fs-ticket__timer--${ticket.delayed ? 'late' : ticket.status}`}
        >
          <Clock size={14} aria-hidden="true" />
          {timer}
        </span>
      </header>

      <ul className="fs-ticket__items">
        {ticket.lines.map((line) => {
          const changes = describeChanges(line.ingredients, t)
          if (line.notes) changes.push(line.notes)
          return (
            <li key={line.id}>
              <span className="fs-ticket__qty">{line.quantity}×</span>
              <span>
                {line.name}
                {changes.length > 0 && <small>{changes.join(' · ')}</small>}
              </span>
            </li>
          )
        })}
      </ul>

      {ticket.delayed && (
        <p className="fs-ticket__late">
          <Flame size={14} aria-hidden="true" />
          {t('kitchen.overTarget', { count: over })}
        </p>
      )}

      {action && (
        <Button
          variant={ACTION_VARIANT[action]}
          icon={ArrowRight}
          disabled={busy}
          onClick={onAdvance}
          className="fs-ticket__action"
        >
          {t(`kitchen.actions.${action}`)}
        </Button>
      )}
    </motion.li>
  )
}
