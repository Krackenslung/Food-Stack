import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { db } from '../mocks/db'
import { handlers } from '../mocks/handlers'

export const server = setupServer(...handlers)

/** Call at the top of a test file to run its requests against the mock API. */
export function setupMockApi() {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
  afterEach(() => {
    server.resetHandlers()
    db.reset()
  })
  afterAll(() => server.close())
}
