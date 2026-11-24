import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation, useRoutes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import i18n from '../lib/i18n'
import { AppProviders } from './providers/AppProviders'
import { routes } from './routes'

function mockSession(user: Record<string, unknown> | null) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      user
        ? {
            ok: true,
            status: 200,
            text: () => Promise.resolve(JSON.stringify({ status: 0, data: user })),
          }
        : {
            ok: false,
            status: 401,
            text: () =>
              Promise.resolve(JSON.stringify({ status: 1, errorMessage: 'Not authenticated' })),
          },
    ),
  )
}

function Routed() {
  const location = useLocation()
  const element = useRoutes(routes)
  return (
    <>
      <output data-testid="location" data-state={JSON.stringify(location.state)}>
        {location.pathname}
      </output>
      {element}
    </>
  )
}

function renderAt(path: string) {
  render(
    <AppProviders>
      <MemoryRouter initialEntries={[path]}>
        <Routed />
      </MemoryRouter>
    </AppProviders>,
  )
}

const pathname = () => screen.getByTestId('location').textContent

afterEach(async () => {
  vi.unstubAllGlobals()
  await act(async () => {
    await i18n.changeLanguage('en')
  })
})

describe('routing and guards', () => {
  it('renders public screens without a session', async () => {
    mockSession(null)
    renderAt('/menu')
    expect(await screen.findByRole('heading', { name: 'Menu' })).toBeInTheDocument()
  })

  it('shows the 404 page for unknown routes', async () => {
    mockSession(null)
    renderAt('/nope')
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
  })

  it('redirects anonymous users from customer screens to /login', async () => {
    mockSession(null)
    renderAt('/checkout')
    await waitFor(() => expect(pathname()).toBe('/login'))
    expect(screen.getByTestId('location')).toHaveAttribute(
      'data-state',
      JSON.stringify({ from: '/checkout' }),
    )
  })

  it('lets a customer into checkout', async () => {
    mockSession({ id: 3, name: 'Ana', lastname: 'Gómez', role: 'customer' })
    renderAt('/checkout')
    expect(await screen.findByRole('heading', { name: 'Checkout' })).toBeInTheDocument()
  })

  it('keeps staff out of the admin area', async () => {
    mockSession({ id: 2, name: 'Sam', lastname: 'Cook', role: 'staff' })
    renderAt('/admin')
    await waitFor(() => expect(pathname()).toBe('/'))
  })

  it('keeps customers out of the kitchen', async () => {
    mockSession({ id: 3, name: 'Ana', lastname: 'Gómez', role: 'customer' })
    renderAt('/kitchen')
    await waitFor(() => expect(pathname()).toBe('/'))
  })

  it('lets staff open the kitchen board with a reduced sidebar', async () => {
    mockSession({ id: 2, name: 'Sam', lastname: 'Cook', role: 'staff' })
    renderAt('/kitchen')
    expect(await screen.findByRole('heading', { name: 'Kitchen board' })).toBeInTheDocument()
    expect(screen.queryByText('Products')).not.toBeInTheDocument()
  })

  it('shows the full admin sidebar with "coming soon" items', async () => {
    mockSession({ id: 1, name: 'Jesús', lastname: 'Martín', role: 'admin' })
    renderAt('/admin')
    expect(await screen.findByRole('heading', { name: 'Dashboard', level: 1 })).toBeInTheDocument()
    expect(screen.getAllByText('Coming soon')).toHaveLength(4)
  })
})

describe('language and theme toggles', () => {
  it('switches the UI language, persists it and updates <html lang>', async () => {
    mockSession(null)
    renderAt('/menu')
    await screen.findByRole('heading', { name: 'Menu' })

    await userEvent.click(screen.getAllByRole('button', { name: 'Español' })[0])
    expect(await screen.findByRole('heading', { name: 'Menú' })).toBeInTheDocument()
    expect(document.documentElement.lang).toBe('es')
    expect(window.localStorage.getItem('foodstack-lang')).toBe('es')
  })

  it('applies and persists the chosen theme', async () => {
    mockSession(null)
    renderAt('/menu')
    await screen.findByRole('heading', { name: 'Menu' })

    await userEvent.click(screen.getAllByRole('button', { name: 'Dark' })[0])
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(window.localStorage.getItem('foodstack-theme')).toBe('dark')
  })
})

describe('responsive customer shell', () => {
  it('swaps the top nav for the bottom tab bar below 768px', async () => {
    const original = window.matchMedia
    window.matchMedia = ((query: string) => ({
      matches: query.includes('max-width: 767px'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia

    try {
      mockSession(null)
      renderAt('/menu')
      expect(await screen.findByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument()
      expect(screen.queryByRole('banner')).not.toBeInTheDocument()
    } finally {
      window.matchMedia = original
    }
  })

  it('shows the top nav on desktop widths', async () => {
    mockSession(null)
    renderAt('/menu')
    expect(await screen.findByRole('banner')).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Main navigation' })).not.toBeInTheDocument()
  })
})
