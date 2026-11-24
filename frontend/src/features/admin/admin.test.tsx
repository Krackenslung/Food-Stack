import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { setupMockApi } from '../../test/msw'
import { renderApp, signInAs } from '../../test/render'
import { margin, toInput, validateDraft, EMPTY_DRAFT } from './productForm'
import { niceMax } from './RevenueChart'
import { actionFor, formatTimer, shortName } from '../kitchen/kitchen'

setupMockApi()

describe('pure helpers', () => {
  it('formats kitchen values', () => {
    expect(shortName('Luis Romero')).toBe('Luis R.')
    expect(formatTimer(372)).toBe('6:12')
    expect(actionFor({ status: 'ready', fulfillmentType: 'delivery' })).toBe('handToRider')
    expect(actionFor({ status: 'completed', fulfillmentType: 'pickup' })).toBeNull()
  })

  it('rounds chart axes to nice numbers', () => {
    expect(niceMax(3400)).toBe(5000)
    expect(niceMax(0)).toBe(1)
  })

  it('validates and converts the product draft', () => {
    expect(Object.keys(validateDraft(EMPTY_DRAFT))).toEqual(
      expect.arrayContaining(['nameEn', 'nameEs', 'price', 'cost']),
    )
    const ok = {
      ...EMPTY_DRAFT,
      price: '9.5',
      cost: '3',
      translations: { en: { name: 'A', description: '' }, es: { name: 'B', description: '' } },
    }
    expect(validateDraft(ok)).toEqual({})
    expect(toInput(ok).price).toBe('9.50')
    expect(margin('10', '4')).toEqual({ percent: 60, profit: 6 })
  })
})

describe('kitchen board', () => {
  it('moves a ticket forward when staff press the action', async () => {
    signInAs('staff')
    renderApp('/kitchen')
    const accept = await screen.findAllByRole('button', { name: /accept & start/i })
    const before = accept.length
    await userEvent.click(accept[0])
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /accept & start/i })).toHaveLength(before - 1),
    )
  })
})

describe('admin screens', () => {
  it('blocks staff from admin routes', async () => {
    signInAs('staff')
    renderApp('/admin/products')
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Products' })).toBeNull())
  })

  it('lists products and filters by search', async () => {
    signInAs('admin')
    renderApp('/admin/products')
    expect(await screen.findByRole('heading', { name: 'Products', level: 1 })).toBeInTheDocument()
    await screen.findByText(/Overkill/i)
    await userEvent.type(screen.getByRole('searchbox'), 'zzzz-none')
    expect(await screen.findByText('No products found')).toBeInTheDocument()
  })

  it('opens the order drawer from the orders table', async () => {
    signInAs('admin')
    renderApp('/admin/orders')
    const rows = await screen.findAllByRole('row')
    await userEvent.click(rows[1])
    const dialog = await screen.findByRole('dialog', { name: 'Order details' })
    expect(await within(dialog).findByText('Activity')).toBeInTheDocument()
  })

  it('shows validation errors in the product editor and does not save', async () => {
    signInAs('admin')
    renderApp('/admin/products/new')
    await userEvent.click(await screen.findByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText('Please fix the highlighted fields.')).toBeInTheDocument()
  })
})
