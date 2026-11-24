import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, request } from '../../lib/api-client'
import { api } from '../../lib/api/endpoints'
import { DEMO_GOOGLE_ACCOUNT, mockCredential } from '../../mocks/credential'
import { db } from '../../mocks/db'
import { setupMockApi } from '../../test/msw'
import { currentPath, renderApp, signInAs } from '../../test/render'

setupMockApi()

const SLOW = { timeout: 4000 }

async function codeOf(promise: Promise<unknown>) {
  try {
    await promise
    return null
  } catch (error) {
    return error instanceof ApiError ? error.errorCode : String(error)
  }
}

describe('Google sign-in (demo button)', () => {
  beforeEach(() => {
    window.localStorage.setItem('foodstack-demo-mode', '1')
  })

  it('signs in with the demo Google account and creates a customer', async () => {
    signInAs(null)
    renderApp('/login')
    await userEvent.click(
      await screen.findByRole('button', { name: 'Continue with Google (demo)' }),
    )

    await waitFor(() => expect(currentPath()).toBe('/'), SLOW)
    expect(await screen.findByRole('link', { name: /Account$/ }, SLOW)).toHaveTextContent('GD')
    const created = db.users().find((user) => user.email === 'google.demo@example.com')
    expect(created).toMatchObject({
      role: 'customer',
      password: '',
      googleSub: 'demo-google-sub-1',
    })
  })

  it('reuses the same account the second time', async () => {
    signInAs(null)
    renderApp('/login')
    await userEvent.click(await screen.findByRole('button', { name: /Continue with Google/ }))
    await waitFor(() => expect(currentPath()).toBe('/'), SLOW)

    signInAs(null)
    await api.googleLogin(mockCredential(DEMO_GOOGLE_ACCOUNT))
    expect(db.users().filter((user) => user.googleSub === 'demo-google-sub-1')).toHaveLength(1)
  })

  it('shows the button with the divider on sign up too, in Spanish', async () => {
    signInAs(null)
    renderApp('/signup')
    expect(await screen.findByRole('button', { name: /Continue with Google/ })).toBeInTheDocument()
    expect(screen.getByRole('separator')).toHaveTextContent('or with email')

    await userEvent.click(screen.getAllByRole('button', { name: 'ES, Español' })[0])
    expect(
      await screen.findByRole('button', { name: 'Continuar con Google (demo)' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('separator')).toHaveTextContent('o con tu correo')
  })

  it('returns to the page the visitor was heading for', async () => {
    signInAs(null)
    renderApp('/account/orders')
    await userEvent.click(await screen.findByRole('button', { name: /Continue with Google/ }, SLOW))
    await waitFor(() => expect(currentPath()).toBe('/account/orders'), SLOW)
  })
})

describe('Google sign-in rules (same as the backend)', () => {
  it('links an existing account by verified email and never grants a role', async () => {
    const credential = mockCredential({
      sub: 'g-staff',
      email: 'Staff@FoodStack.local',
      email_verified: true,
      role: 'admin', // ignored: roles only come from our database
    })
    await api.googleLogin(credential)

    const session = await request<{ user: { role: string; email: string } }>('/session')
    expect(session.user).toMatchObject({ role: 'staff', email: 'staff@foodstack.local' })
    expect(db.users().find((user) => user.email === 'staff@foodstack.local')?.googleSub).toBe(
      'g-staff',
    )
  })

  it('new Google users are always customers', async () => {
    await api.googleLogin(
      mockCredential({
        sub: 'g-new',
        email: 'new@example.com',
        email_verified: true,
        role: 'admin',
      }),
    )
    const session = await request<{ user: { role: string } }>('/session')
    expect(session.user.role).toBe('customer')
  })

  it('rejects unverified emails, forged tokens and emails linked to another Google account', async () => {
    const unverified = mockCredential({ sub: 'g-1', email: 'a@example.com', email_verified: false })
    expect(await codeOf(api.googleLogin(unverified))).toBe('EMAIL_NOT_VERIFIED')
    expect(await codeOf(api.googleLogin('forged'))).toBe('INVALID_GOOGLE_TOKEN')
    expect(db.users().some((user) => user.email === 'a@example.com')).toBe(false)

    await api.googleLogin(
      mockCredential({ sub: 'g-owner', email: 'taken@example.com', email_verified: true }),
    )
    const attacker = mockCredential({
      sub: 'g-attacker',
      email: 'taken@example.com',
      email_verified: true,
    })
    expect(await codeOf(api.googleLogin(attacker))).toBe('ACCOUNT_LINKED_ELSEWHERE')
  })

  it('google-only accounts cannot sign in with a blank password', async () => {
    await api.googleLogin(
      mockCredential({ sub: 'g-x', email: 'x@example.com', email_verified: true }),
    )
    expect(await codeOf(api.login({ email: 'x@example.com', password: '' }))).toBe(
      'INVALID_CREDENTIALS',
    )
  })
})

describe('Google sign-in availability', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    delete window.google
  })

  it('is hidden when Google is not configured and demo mode is off', async () => {
    window.localStorage.setItem('foodstack-demo-mode', '0')
    signInAs(null)
    renderApp('/login')
    await screen.findByRole('heading', { name: 'Welcome back' })
    expect(screen.queryByRole('button', { name: /Continue with Google/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('separator')).not.toBeInTheDocument()
  })

  it("draws Google's own button when a client id is set and exchanges the credential", async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'client-123.apps.googleusercontent.com')
    let callback: (response: { credential: string }) => void = () => {}
    const initialize = vi.fn((config: { callback: typeof callback }) => {
      callback = config.callback
    })
    const renderButton = vi.fn()
    window.google = { accounts: { id: { initialize, renderButton } } }

    signInAs(null)
    renderApp('/login')
    await waitFor(() => expect(renderButton).toHaveBeenCalled(), SLOW)

    expect(initialize.mock.calls[0][0]).toMatchObject({
      client_id: 'client-123.apps.googleusercontent.com',
    })
    expect(renderButton.mock.calls[0][1]).toMatchObject({
      text: 'signin_with',
      theme: 'outline',
      locale: 'en',
    })
    // No demo button next to the official one.
    expect(screen.queryByRole('button', { name: /Continue with Google/ })).not.toBeInTheDocument()

    // Google hands the browser an ID token; we exchange it with the backend.
    await act(async () => {
      callback({
        credential: mockCredential({
          sub: 'g-real',
          email: 'real@example.com',
          email_verified: true,
        }),
      })
    })
    await waitFor(() => expect(currentPath()).toBe('/'), SLOW)
  })
})
