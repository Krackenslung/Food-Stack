import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { api } from '../lib/api/endpoints'
import { setupMockApi } from '../test/msw'
import { currentPath, renderApp, signInAs } from '../test/render'
import { useCartStore } from './cart/cartStore'

setupMockApi()

const SLOW = { timeout: 4000 }

beforeEach(() => {
  // The mock store opens 11:00-23:00 Tijuana time; pin it open so tests don't depend on the clock.
  window.localStorage.setItem('foodstack-mock-open', '1')
})

const addBurger = () =>
  useCartStore.getState().add({
    productId: 1,
    name: 'Overkill Double Burger',
    image: '/menu/overkill-double.jpg',
    quantity: 1,
    ingredients: [],
    notes: '',
  })

async function placeOrder() {
  signInAs('customer')
  return api.checkout({
    items: [{ productId: 1, quantity: 1, ingredients: [] }],
    fulfillmentType: 'pickup',
    contact: { name: 'Test Customer', phone: '5551234567', email: 'customer@foodstack.local' },
    paymentMethod: 'counter',
  })
}

describe('menu and cart panel', () => {
  it('quick-adds a product, confirms with a toast and prices it through the quote', async () => {
    signInAs(null)
    renderApp('/menu')
    const addButtons = await screen.findAllByRole('button', { name: 'Add to cart' })
    await userEvent.click(addButtons[0])

    expect(await screen.findByText('Overkill Double Burger added to your cart')).toBeInTheDocument()
    // 12.99 + 1.50 service fee + 8% tax on 14.49 (1.16) = 15.65, from the server quote.
    expect(await screen.findByRole('button', { name: 'Checkout · $15.65' }, SLOW)).toBeEnabled()
    expect(screen.getByText('1 item')).toBeInTheDocument()
  })

  it('customizes a product in the modal and shows the change in the cart', async () => {
    signInAs(null)
    renderApp('/menu')
    await userEvent.click(await screen.findByRole('button', { name: 'Overkill Double Burger' }))

    const dialog = await screen.findByRole('dialog')
    await userEvent.click(await within(dialog).findByRole('checkbox', { name: /Crispy bacon/ }))
    // 12.99 + 1.50 bacon, priced by the server.
    const add = await within(dialog).findByRole('button', { name: 'Add to order · $14.49' }, SLOW)
    await userEvent.click(add)

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(currentPath()).toBe('/menu')
    expect(await screen.findByText('Add Crispy bacon')).toBeInTheDocument()
  })

  it('closes the modal with Escape', async () => {
    signInAs(null)
    renderApp('/menu/1')
    await screen.findByRole('dialog')
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(currentPath()).toBe('/menu')
  })

  it('filters by category chip and by search query', async () => {
    signInAs(null)
    renderApp('/menu')
    await screen.findByText('Overkill Double Burger')

    await userEvent.click(screen.getByRole('button', { name: 'Beverages' }))
    expect(screen.queryByText('Overkill Double Burger')).not.toBeInTheDocument()
    expect(screen.getByText('Iced Horchata')).toBeInTheDocument()
  })
})

describe('cart page', () => {
  it('shows an empty state with a way back to the menu', async () => {
    signInAs(null)
    renderApp('/cart')
    expect(await screen.findByText('Your cart is empty')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Browse the menu/ })).toBeInTheDocument()
  })

  it('applies a promo code through the quote and reports invalid codes', async () => {
    signInAs(null)
    addBurger()
    renderApp('/cart')
    expect((await screen.findAllByText('$12.99', undefined, SLOW)).length).toBeGreaterThan(0)

    const input = screen.getByLabelText('Promo code')
    await userEvent.type(input, 'FOODSTACK20')
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }))
    expect(await screen.findByText('FOODSTACK20 applied', undefined, SLOW)).toBeInTheDocument()
    expect(screen.getByText('−$2.60')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Remove' }))
    await userEvent.type(screen.getByLabelText('Promo code'), 'NOPE')
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }))
    expect(await screen.findByRole('alert', undefined, SLOW)).toHaveTextContent(
      "We don't recognize that promo code.",
    )
  })

  it('changes quantity with the stepper and removes lines', async () => {
    signInAs(null)
    addBurger()
    renderApp('/cart')
    await userEvent.click(await screen.findByRole('button', { name: 'Increase quantity' }))
    expect(useCartStore.getState().items[0].quantity).toBe(2)

    await userEvent.click(screen.getByRole('button', { name: /Remove/ }))
    expect(await screen.findByText('Your cart is empty')).toBeInTheDocument()
  })

  it('sends anonymous shoppers to log in before checkout', async () => {
    signInAs(null)
    addBurger()
    renderApp('/cart')
    await userEvent.click(await screen.findByRole('button', { name: 'Log in to check out' }))
    await waitFor(() => expect(currentPath()).toBe('/login'))
  })
})

describe('checkout', () => {
  it('validates the form, places a pay-at-counter order and lands on tracking', async () => {
    signInAs('customer')
    addBurger()
    renderApp('/checkout')

    const place = await screen.findByRole('button', { name: /Place order · \$15\.65/ }, SLOW)
    await userEvent.click(place)
    expect(await screen.findByText('Enter a phone number.')).toBeInTheDocument()
    expect(currentPath()).toBe('/checkout')

    await userEvent.type(screen.getByLabelText('Phone'), '5551234567')
    await userEvent.click(screen.getByRole('button', { name: /Place order/ }))

    await waitFor(() => expect(currentPath()).toBe('/orders/1'), SLOW)
    expect(
      await screen.findByRole('heading', { name: 'We got your order' }, SLOW),
    ).toBeInTheDocument()
    expect(useCartStore.getState().items).toEqual([])
  })

  it('requires an address for delivery and adds the delivery fee', async () => {
    signInAs('customer')
    addBurger()
    renderApp('/checkout')
    await userEvent.click(await screen.findByRole('radio', { name: /Delivery/ }))
    await userEvent.type(screen.getByLabelText('Phone'), '5551234567')
    await userEvent.click(await screen.findByRole('button', { name: /Place order/ }))
    expect(await screen.findByText('Enter a delivery address.')).toBeInTheDocument()
    expect(await screen.findByText('Delivery fee', undefined, SLOW)).toBeInTheDocument()
  })

  it('disables ordering while the store is closed', async () => {
    window.localStorage.setItem('foodstack-mock-open', '0')
    signInAs('customer')
    addBurger()
    renderApp('/checkout')
    expect(await screen.findByRole('alert', undefined, SLOW)).toHaveTextContent('closed')
    expect(await screen.findByRole('button', { name: /Place order/ })).toBeDisabled()
  })

  it('sends people with an empty cart back to /cart', async () => {
    signInAs('customer')
    renderApp('/checkout')
    await waitFor(() => expect(currentPath()).toBe('/cart'))
  })
})

describe('authentication screens', () => {
  it('shows a translated error for wrong credentials and signs in with the right ones', async () => {
    signInAs(null)
    renderApp('/login')
    await userEvent.type(await screen.findByLabelText('Email'), 'customer@foodstack.local')
    await userEvent.type(screen.getByLabelText('Password'), 'wrong-password')
    await userEvent.click(screen.getByRole('button', { name: /Sign in/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password.')

    await userEvent.clear(screen.getByLabelText('Password'))
    await userEvent.type(screen.getByLabelText('Password'), 'Customer123!')
    await userEvent.click(screen.getByRole('button', { name: /Sign in/ }))
    await waitFor(() => expect(currentPath()).toBe('/'), SLOW)
  })

  it('sends staff to the kitchen and returns to the page they were heading for', async () => {
    signInAs(null)
    renderApp('/login')
    await userEvent.type(await screen.findByLabelText('Email'), 'staff@foodstack.local')
    await userEvent.type(screen.getByLabelText('Password'), 'Staff123!')
    await userEvent.click(screen.getByRole('button', { name: /Sign in/ }))
    await waitFor(() => expect(currentPath()).toBe('/kitchen'), SLOW)
  })

  it('validates sign up, shows password strength and creates a customer', async () => {
    signInAs(null)
    renderApp('/signup')
    await userEvent.click(await screen.findByRole('button', { name: /Create account/ }))
    expect(await screen.findByText('Enter your first name.')).toBeInTheDocument()
    expect(screen.getByText('You need to accept the terms to continue.')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('First name'), 'Ana')
    await userEvent.type(screen.getByLabelText('Last name'), 'García')
    await userEvent.type(screen.getByLabelText('Email'), 'ana@example.com')
    await userEvent.type(screen.getByLabelText('Phone (for order updates)'), '6195550148')
    await userEvent.type(screen.getByLabelText('Password'), 'Abcdefgh1!')
    expect(screen.getByText(/Strong password/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('checkbox'))
    await userEvent.click(screen.getByRole('button', { name: /Create account/ }))
    await waitFor(() => expect(currentPath()).toBe('/'), SLOW)

    // The same email cannot register twice.
    signInAs(null)
  })

  it('reports a duplicate email', async () => {
    signInAs(null)
    renderApp('/signup')
    await userEvent.type(await screen.findByLabelText('First name'), 'Test')
    await userEvent.type(screen.getByLabelText('Last name'), 'Customer')
    await userEvent.type(screen.getByLabelText('Email'), 'customer@foodstack.local')
    await userEvent.type(screen.getByLabelText('Phone (for order updates)'), '5551234567')
    await userEvent.type(screen.getByLabelText('Password'), 'Abcdefgh1!')
    await userEvent.click(screen.getByRole('checkbox'))
    await userEvent.click(screen.getByRole('button', { name: /Create account/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('already registered')
  })
})

describe('orders', () => {
  it('lists active orders with a Track link and filters by status', async () => {
    await placeOrder()
    renderApp('/account/orders')
    expect(await screen.findByText('#FS-1001', undefined, SLOW)).toBeInTheDocument()
    const links = screen.getAllByRole('link', { name: /Track order/ })
    expect(links.some((link) => link.getAttribute('href') === '/orders/1')).toBe(true)

    await userEvent.click(screen.getByRole('button', { name: 'Completed' }))
    expect(await screen.findByText('No orders here yet', undefined, SLOW)).toBeInTheDocument()
  })

  it('shows the live tracking page and lets the customer cancel while "received"', async () => {
    await placeOrder()
    renderApp('/orders/1')
    expect(
      await screen.findByRole('heading', { name: 'We got your order' }, SLOW),
    ).toBeInTheDocument()
    expect(screen.getByText(/Ready in/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Need to cancel/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Yes, cancel' }))
    expect(
      await screen.findByRole('heading', { name: 'This order was cancelled' }, SLOW),
    ).toBeInTheDocument()
  })

  it('reorders a finished order into the cart', async () => {
    await placeOrder()
    await api.cancelOrder(1)
    renderApp('/account/orders')
    await userEvent.click(await screen.findByRole('button', { name: 'Reorder' }, SLOW))
    await waitFor(() => expect(currentPath()).toBe('/cart'), SLOW)
    expect(useCartStore.getState().items[0]).toMatchObject({ productId: 1, quantity: 1 })
  })

  it("forbids reading someone else's order", async () => {
    await placeOrder()
    db_switchToOtherCustomer()
    renderApp('/orders/1')
    expect(await screen.findByRole('alert', undefined, SLOW)).toHaveTextContent(
      "You don't have access",
    )
  })
})

/** A second customer account (not the one that placed order 1). */
function db_switchToOtherCustomer() {
  window.localStorage.setItem(
    'foodstack-mock-users',
    JSON.stringify([
      {
        id: 3,
        name: 'Test',
        lastname: 'Customer',
        email: 'customer@foodstack.local',
        phoneNumber: '5551234567',
        password: 'Customer123!',
        role: 'customer',
      },
      {
        id: 9,
        name: 'Other',
        lastname: 'Person',
        email: 'other@example.com',
        phoneNumber: '5550000000',
        password: 'Other123!',
        role: 'customer',
      },
    ]),
  )
  window.localStorage.setItem('foodstack-mock-session', '9')
}
