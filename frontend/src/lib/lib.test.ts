import { afterEach, describe, expect, it, vi } from 'vitest'
import { initialsOf, normalizeUser } from './auth'
import { formatMoney } from './format'
import { normalizeLanguage, resolveLanguage } from './language'
import { applyTheme, readStoredTheme, resolveTheme, storeTheme } from './theme'

describe('theme', () => {
  it('follows the OS only for the system preference', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })

  it('persists and ignores invalid stored values', () => {
    expect(readStoredTheme()).toBeNull()
    storeTheme('dark')
    expect(readStoredTheme()).toBe('dark')
    window.localStorage.setItem('foodstack-theme', 'neon')
    expect(readStoredTheme()).toBeNull()
  })

  it('sets data-theme on <html>', () => {
    applyTheme('dark')
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
  })
})

describe('language', () => {
  it('normalizes regional codes and rejects unsupported ones', () => {
    expect(normalizeLanguage('es-MX')).toBe('es')
    expect(normalizeLanguage('EN_us')).toBe('en')
    expect(normalizeLanguage('fr-FR')).toBeNull()
    expect(normalizeLanguage(undefined)).toBeNull()
  })

  it('resolves stored -> user preference -> navigator -> en', () => {
    expect(
      resolveLanguage({ stored: 'es', userPreference: 'en', navigatorLanguage: 'en-US' }),
    ).toBe('es')
    expect(resolveLanguage({ userPreference: 'es', navigatorLanguage: 'en-US' })).toBe('es')
    expect(resolveLanguage({ navigatorLanguage: 'es-MX' })).toBe('es')
    expect(resolveLanguage({ navigatorLanguage: 'de-DE' })).toBe('en')
    expect(resolveLanguage({})).toBe('en')
  })
})

describe('auth user normalization', () => {
  it('accepts the legacy snake_case row and the camelCase { user } contract', () => {
    const legacy = normalizeUser({
      id: 4,
      name: 'Ana',
      lastname: 'Gómez',
      email: 'a@b.c',
      role: 'Admin',
      preferred_language: 'es',
    })
    expect(legacy).toMatchObject({ id: 4, role: 'admin', preferredLanguage: 'es' })

    const target = normalizeUser({
      user: { id: 5, name: 'Bo', role: 'customer', preferredTheme: 'dark' },
    })
    expect(target).toMatchObject({ id: 5, role: 'customer', preferredTheme: 'dark' })
  })

  it('rejects payloads without a valid id or role', () => {
    expect(normalizeUser(null)).toBeNull()
    expect(normalizeUser({ id: 0, role: 'admin' })).toBeNull()
    expect(normalizeUser({ id: 1, role: 'owner' })).toBeNull()
  })

  it('builds initials', () => {
    expect(initialsOf({ name: 'ana', lastname: 'gómez' })).toBe('AG')
    expect(initialsOf({ name: 'Ana', lastname: '' })).toBe('A')
    expect(initialsOf(null)).toBe('')
  })
})

describe('format', () => {
  it('formats money for each locale', () => {
    expect(formatMoney(28.8, 'en')).toBe('$28.80')
    expect(formatMoney('1234.5', 'es', 'MXN')).toContain('1,234.50')
  })
})

describe('api-client', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  async function loadClient() {
    return import('./api-client')
  }

  function mockFetch(status: number, body: unknown) {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      text: () => Promise.resolve(body === null ? '' : JSON.stringify(body)),
    })
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }

  it('unwraps the envelope data and sends the bearer token', async () => {
    const { request, tokenStore } = await loadClient()
    tokenStore.save('abc')
    const fetchMock = mockFetch(200, { status: 0, data: { id: 1 } })

    await expect(request('/orders')).resolves.toEqual({ id: 1 })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/orders')
    expect(init.headers.Authorization).toBe('Bearer abc')
  })

  it('throws ApiError with the errorCode for envelope errors on HTTP 200 (legacy)', async () => {
    const { request, ApiError } = await loadClient()
    mockFetch(200, { status: 1, errorMessage: 'nope', errorCode: 'ORDER_NOT_FOUND' })

    await expect(request('/orders/9')).rejects.toMatchObject({
      name: 'ApiError',
      errorCode: 'ORDER_NOT_FOUND',
    })
    await expect(request('/orders/9')).rejects.toBeInstanceOf(ApiError)
  })

  it('maps non-2xx responses to ApiError with the HTTP status', async () => {
    const { request } = await loadClient()
    mockFetch(403, { status: 1, errorMessage: 'Forbidden', errorCode: 'FORBIDDEN' })
    await expect(request('/orders')).rejects.toMatchObject({
      httpStatus: 403,
      errorCode: 'FORBIDDEN',
    })

    mockFetch(502, null)
    await expect(request('/orders')).rejects.toMatchObject({ errorCode: 'HTTP_502' })
  })

  it('reports an unreachable API as NETWORK_ERROR and can skip auth', async () => {
    const { request, tokenStore } = await loadClient()
    tokenStore.save('abc')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('failed')))
    await expect(request('/menu')).rejects.toMatchObject({ errorCode: 'NETWORK_ERROR' })

    const fetchMock = mockFetch(200, { status: 0, data: [] })
    await request('/menu', { auth: false })
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined()
  })
})
