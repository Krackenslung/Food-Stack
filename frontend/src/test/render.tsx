import { render } from '@testing-library/react'
import { MemoryRouter, useLocation, useRoutes } from 'react-router-dom'
import { screen } from '@testing-library/react'
import { AppProviders } from '../app/providers/AppProviders'
import { routes } from '../app/routes'
import { db } from '../mocks/db'

/** Seeded mock accounts (see mocks/db.ts). */
export const ACCOUNTS = { admin: 1, staff: 2, customer: 3 } as const

export function signInAs(role: keyof typeof ACCOUNTS | null) {
  db.setSession(role ? ACCOUNTS[role] : null)
}

function Routed() {
  const location = useLocation()
  const element = useRoutes(routes)
  return (
    <>
      <output data-testid="location" data-state={JSON.stringify(location.state)}>
        {location.pathname + location.search}
      </output>
      {element}
    </>
  )
}

/** Render the full app (providers + real routes) against the mock API. */
export function renderApp(path: string) {
  return render(
    <AppProviders>
      <MemoryRouter initialEntries={[path]}>
        <Routed />
      </MemoryRouter>
    </AppProviders>,
  )
}

export const currentPath = () => screen.getByTestId('location').textContent
