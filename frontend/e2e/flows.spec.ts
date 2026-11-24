import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

// Seeded mock accounts (same as scripts/seed_users.py).
const ACCOUNTS = {
  customer: ['customer@foodstack.local', 'Customer123!'],
  staff: ['staff@foodstack.local', 'Staff123!'],
  admin: ['admin@foodstack.local', 'Admin123!'],
} as const

async function signIn(page: Page, role: keyof typeof ACCOUNTS) {
  const [email, password] = ACCOUNTS[role]
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL((url) => url.pathname !== '/login') // the session cookie is set by then
}

test.beforeEach(async ({ page }) => {
  // Fresh mock database per test.
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('e2e-reset')) {
      localStorage.clear()
      sessionStorage.setItem('e2e-reset', '1')
    }
  })
})

test('customer logs in, orders at the counter and lands on tracking', async ({ page }) => {
  await signIn(page, 'customer')
  await page.goto('/menu')
  await expect(page.getByRole('heading', { name: 'Our menu', level: 1 })).toBeVisible()

  await page.getByRole('button', { name: 'Add to cart' }).first().click()
  await page.goto('/cart')
  await page.getByRole('button', { name: 'Go to checkout' }).click()

  await expect(page).toHaveURL(/\/checkout/)
  await page.getByLabel('Phone').fill('664 555 0101')
  await page.getByText('Pay at counter').first().click()
  await page.getByRole('button', { name: /^Place order/ }).click()

  await expect(page).toHaveURL(/\/orders\/\d+/)
  await expect(page.getByText(/Order #FS-/)).toBeVisible()
})

test('staff sees the kitchen board and moves a ticket forward', async ({ page }) => {
  await signIn(page, 'staff')
  await page.goto('/kitchen')
  await expect(page.getByRole('heading', { name: 'Kitchen board', level: 1 })).toBeVisible()

  const accept = page.getByRole('button', { name: 'Accept & start' })
  const before = await accept.count()
  expect(before).toBeGreaterThan(0)
  await accept.first().click()
  await expect(accept).toHaveCount(before - 1)
})

test('staff cannot open admin pages', async ({ page }) => {
  await signIn(page, 'staff')
  await page.goto('/admin/products')
  await expect(page.getByRole('heading', { name: 'Products', level: 1 })).toHaveCount(0)
})

test('admin edits a product and the change shows in the list', async ({ page }) => {
  await signIn(page, 'admin')
  await page.goto('/admin/products')
  await page
    .getByRole('link', { name: /^Edit / })
    .first()
    .click()

  const price = page.getByLabel('Price', { exact: true })
  await price.fill('13.40')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('Product saved')).toBeVisible()

  await page.goto('/admin/products')
  await expect(page.getByText('$13.40').first()).toBeVisible()
})
