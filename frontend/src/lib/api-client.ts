/**
 * Typed port of the legacy js/api-client.js. The backend always answers with the envelope
 * { status: 0, data } | { status: 1, errorMessage, errorCode? }; errors are thrown as ApiError
 * and the UI translates them from `errorCode`, never from `errorMessage`.
 */

export const AUTH_TOKEN_KEY = 'foodstack-auth-token'
export const API_BASE_STORAGE_KEY = 'foodstack-api-base-url'

export class ApiError extends Error {
  readonly httpStatus: number | null
  readonly errorCode: string

  constructor(message: string, errorCode: string, httpStatus: number | null = null) {
    super(message)
    this.name = 'ApiError'
    this.errorCode = errorCode
    this.httpStatus = httpStatus
  }
}

type Envelope<T> = { status: number; data?: T; errorMessage?: string; errorCode?: string }

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  /** Multipart upload; the browser sets the boundary, so no Content-Type here. */
  form?: FormData
  /** Set false to skip the Authorization header. */
  auth?: boolean
  signal?: AbortSignal
}

function safeStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function resolveApiBaseUrl(): string {
  const configured = String(import.meta.env.VITE_API_BASE_URL ?? '').trim()
  const stored = safeStorage()?.getItem(API_BASE_STORAGE_KEY)?.trim()
  const base = configured || stored || '/api'
  return base.replace(/\/+$/, '')
}

export const tokenStore = {
  read: () => safeStorage()?.getItem(AUTH_TOKEN_KEY)?.trim() || '',
  save: (token: string) => safeStorage()?.setItem(AUTH_TOKEN_KEY, token.trim()),
  clear: () => safeStorage()?.removeItem(AUTH_TOKEN_KEY),
}

async function parseJson(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function isEnvelope(payload: unknown): payload is Envelope<unknown> {
  return typeof payload === 'object' && payload !== null && 'status' in payload
}

export async function request<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, form, auth = true, signal } = options
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  const token = auth ? tokenStore.read() : ''
  if (token) headers.Authorization = `Bearer ${token}`

  let response: Response
  try {
    response = await fetch(`${resolveApiBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`, {
      method,
      headers,
      credentials: 'same-origin',
      body: form ?? (body === undefined ? undefined : JSON.stringify(body)),
      signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError('API is unreachable.', 'NETWORK_ERROR')
  }

  const payload = await parseJson(response)

  if (!response.ok) {
    const envelope = isEnvelope(payload) ? payload : null
    throw new ApiError(
      envelope?.errorMessage ?? `API request failed (${response.status}).`,
      envelope?.errorCode ?? `HTTP_${response.status}`,
      response.status,
    )
  }

  if (isEnvelope(payload)) {
    if (Number(payload.status) !== 0) {
      throw new ApiError(
        payload.errorMessage ?? 'API returned an error response.',
        payload.errorCode ?? 'API_STATUS_ERROR',
        response.status,
      )
    }
    return (payload.data ?? payload) as T
  }

  return payload as T
}
