/**
 * Demo / mock-API mode. Until the backend implements the new contract endpoints the app runs on
 * MSW handlers. Toggle with ?demo=1|0, localStorage['foodstack-demo-mode'] or VITE_MOCK_API.
 * Default: ON for `npm run dev`, OFF for production builds.
 */
const STORAGE_KEY = 'foodstack-demo-mode'

function readFlag(): string | null {
  try {
    const fromQuery = new URLSearchParams(window.location.search).get('demo')
    if (fromQuery === '1' || fromQuery === '0') {
      window.localStorage.setItem(STORAGE_KEY, fromQuery)
      return fromQuery
    }
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function shouldMock(): boolean {
  const flag = readFlag()
  if (flag === '1') return true
  if (flag === '0') return false
  const env = import.meta.env.VITE_MOCK_API
  if (env === 'true') return true
  if (env === 'false') return false
  return import.meta.env.DEV
}

export async function enableMocking(): Promise<void> {
  if (!shouldMock()) return
  const { worker } = await import('./browser')
  await worker.start({ onUnhandledRequest: 'bypass', quiet: true })
}
