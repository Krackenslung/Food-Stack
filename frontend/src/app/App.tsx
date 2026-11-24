import { useState } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { AppProviders } from './providers/AppProviders'
import { routes } from './routes'

export function App() {
  const [router] = useState(() => createBrowserRouter(routes))

  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  )
}
