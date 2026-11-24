/**
 * Client-side sanity check for "Schedule for later". The server re-validates against the
 * store's real hours and timezone; this only avoids obviously wrong picks.
 */
export type ScheduleError =
  'SCHEDULE_REQUIRED' | 'SCHEDULE_PAST' | 'SCHEDULE_TOO_FAR' | 'SCHEDULE_OUTSIDE_HOURS'

const MIN_LEAD_MINUTES = 15

function minutesOf(hhmm: string): number {
  const [hours, minutes] = hhmm.split(':').map(Number)
  return hours * 60 + minutes
}

/** `value` is a datetime-local string ("2026-11-24T18:30"), interpreted in the browser's zone. */
export function validateSchedule(
  value: string,
  now: Date,
  opensAt: string,
  closesAt: string,
): ScheduleError | null {
  if (!value) return 'SCHEDULE_REQUIRED'
  const when = new Date(value)
  if (Number.isNaN(when.getTime())) return 'SCHEDULE_REQUIRED'

  if (when.getTime() < now.getTime() + MIN_LEAD_MINUTES * 60_000) return 'SCHEDULE_PAST'

  // Today or tomorrow only.
  const endOfTomorrow = new Date(now)
  endOfTomorrow.setDate(endOfTomorrow.getDate() + 1)
  endOfTomorrow.setHours(23, 59, 59, 999)
  if (when.getTime() > endOfTomorrow.getTime()) return 'SCHEDULE_TOO_FAR'

  const minutes = when.getHours() * 60 + when.getMinutes()
  if (minutes < minutesOf(opensAt) || minutes > minutesOf(closesAt)) return 'SCHEDULE_OUTSIDE_HOURS'

  return null
}

/** Value for <input type="datetime-local" min=…>: now + lead time, in local time. */
export function earliestSchedule(now: Date): string {
  const earliest = new Date(now.getTime() + MIN_LEAD_MINUTES * 60_000)
  const offset = earliest.getTimezoneOffset() * 60_000
  return new Date(earliest.getTime() - offset).toISOString().slice(0, 16)
}
