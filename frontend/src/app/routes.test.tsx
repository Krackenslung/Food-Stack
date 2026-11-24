import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { setupMockApi } from '../test/msw'
import { currentPath, renderApp, signInAs } from '../test/render'

setupMockApi()

describe('routing and guards', () => {
  it('renders public screens without a session', async () => {
    signInAs(null)
    renderApp('/menu')
    expect(await screen.findByRole('heading', { name: 'Our menu' })).toBeInTheDocument()
  })

  it('shows the 404 page for unknown routes', async () => {
    signInAs(null)
    renderApp('/nope')
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
  })

  it('redirects anonymous users from customer screens to /login', async () => {
    signInAs(null)
    renderApp('/account/orders')
    await waitFor(() => expect(currentPath()).toBe('/login'))
    expect(screen.getByTestId('location')).toHaveAttribute(
      'data-state',
      JSON.stringify({ from: '/account/orders' }),
    )
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
  })

  it('lets a customer into their orders', async () => {
    signInAs('customer')
    renderApp('/account/orders')
    expect(await screen.findByRole('heading', { name: 'My orders' })).toBeInTheDocument()
  })

  it('keeps staff out of the admin area', async () => {
    signInAs('staff')
    renderApp('/admin')
    await waitFor(() => expect(currentPath()).toBe('/'))
  })

  it('keeps customers out of the kitchen', async () => {
    signInAs('customer')
    renderApp('/kitchen')
    await waitFor(() => expect(currentPath()).toBe('/'))
  })

  it('lets staff open the kitchen board with a reduced sidebar', async () => {
    signInAs('staff')
    renderApp('/kitchen')
    expect(await screen.findByRole('heading', { name: 'Kitchen board' })).toBeInTheDocument()
    expect(screen.queryByText('Products')).not.toBeInTheDocument()
  })

  it('shows the full admin sidebar with "coming soon" items', async () => {
    signInAs('admin')
    renderApp('/admin')
    expect(
      await screen.findByRole('heading', { name: /good (morning|afternoon|evening)/i, level: 1 }),
    ).toBeInTheDocument()
    expect(screen.getAllByText('Coming soon')).toHaveLength(4)
  })
})

describe('language and theme toggles', () => {
  it('switches the UI language, persists it and updates <html lang>', async () => {
    signInAs(null)
    renderApp('/menu')
    await screen.findByRole('heading', { name: 'Our menu' })

    await userEvent.click(screen.getAllByRole('button', { name: 'ES, Español' })[0])
    expect(await screen.findByRole('heading', { name: 'Nuestro menú' })).toBeInTheDocument()
    expect(document.documentElement.lang).toBe('es')
    expect(window.localStorage.getItem('foodstack-lang')).toBe('es')
    // Catalog text is translated by the API (?lang=), not by the client.
    expect(await screen.findByText('Hamburguesa Overkill Doble')).toBeInTheDocument()
  })

  it('applies and persists the chosen theme', async () => {
    signInAs(null)
    renderApp('/menu')
    await screen.findByRole('heading', { name: 'Our menu' })

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
      signInAs(null)
      renderApp('/menu')
      const tabs = await screen.findByRole('navigation', { name: 'Main navigation' })
      expect(tabs).toHaveTextContent('Home')
      expect(document.querySelector('.fs-customer-nav')).toBeNull()
    } finally {
      window.matchMedia = original
    }
  })

  it('shows the top nav on desktop widths', async () => {
    signInAs(null)
    renderApp('/menu')
    await screen.findByRole('heading', { name: 'Our menu' })
    expect(document.querySelector('.fs-customer-nav')).not.toBeNull()
    expect(screen.queryByRole('navigation', { name: 'Main navigation' })).not.toBeInTheDocument()
  })
})
