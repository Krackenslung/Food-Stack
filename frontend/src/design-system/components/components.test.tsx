import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Badge, Button, Chip, Input, KpiCard, ProductCard, Stepper } from '..'
import { ArrowRight, Mail } from '../icons'

describe('Button', () => {
  it('renders variants and sizes as classes and fires onClick', async () => {
    const onClick = vi.fn()
    render(
      <Button variant="dark" size="L" icon={ArrowRight} onClick={onClick}>
        Pay
      </Button>,
    )
    const button = screen.getByRole('button', { name: 'Pay' })
    expect(button).toHaveClass('fs-btn--dark', 'fs-btn--l')
    expect(button.querySelector('svg')).toBeInTheDocument()
    await userEvent.click(button)
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('does not fire when disabled', async () => {
    const onClick = vi.fn()
    render(
      <Button disabled onClick={onClick}>
        Pay
      </Button>,
    )
    await userEvent.click(screen.getByRole('button'))
    expect(onClick).not.toHaveBeenCalled()
  })
})

describe('Badge and Chip', () => {
  it('applies the tone class', () => {
    render(<Badge tone="danger">Cancelled</Badge>)
    expect(screen.getByText('Cancelled')).toHaveClass('fs-badge--danger')
  })

  it('exposes the active state with aria-pressed', async () => {
    const onClick = vi.fn()
    render(
      <Chip active onClick={onClick}>
        Burgers
      </Chip>,
    )
    const chip = screen.getByRole('button', { name: 'Burgers' })
    expect(chip).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(chip)
    expect(onClick).toHaveBeenCalled()
  })
})

describe('Input', () => {
  it('links label, helper and error to the field for assistive tech', () => {
    const { rerender } = render(<Input label="Email" icon={Mail} helper="We never share it" />)
    const field = screen.getByLabelText('Email')
    expect(field).toHaveAccessibleDescription('We never share it')
    expect(field).not.toHaveAttribute('aria-invalid')

    rerender(<Input label="Email" icon={Mail} error="Enter a valid email" />)
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid email')
  })
})

describe('Stepper', () => {
  it('steps within min and max and disables at the limits', async () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <Stepper
        value={1}
        min={1}
        max={3}
        onChange={onChange}
        decrementLabel="less"
        incrementLabel="more"
      />,
    )
    expect(screen.getByRole('button', { name: 'less' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'more' }))
    expect(onChange).toHaveBeenLastCalledWith(2)

    rerender(
      <Stepper
        value={3}
        min={1}
        max={3}
        onChange={onChange}
        decrementLabel="less"
        incrementLabel="more"
      />,
    )
    expect(screen.getByRole('button', { name: 'more' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'less' }))
    expect(onChange).toHaveBeenLastCalledWith(2)
  })
})

describe('ProductCard and KpiCard', () => {
  it('shows product data and calls onAdd', async () => {
    const onAdd = vi.fn()
    render(
      <ProductCard
        name="BBQ Bacon Burger"
        description="Smoky"
        price="$11.49"
        meta="620 kcal"
        rating="4.8"
        image="/x.jpg"
        addLabel="Add to cart"
        onAdd={onAdd}
      />,
    )
    expect(screen.getByRole('heading', { name: 'BBQ Bacon Burger' })).toBeInTheDocument()
    expect(screen.getByText('$11.49')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Add to cart' }))
    expect(onAdd).toHaveBeenCalledOnce()
  })

  it('shows KPI value, delta and period', () => {
    render(<KpiCard label="Revenue today" value="$4,286" delta="▲ 12.4%" period="vs. last week" />)
    expect(screen.getByText('$4,286')).toBeInTheDocument()
    expect(screen.getByText('▲ 12.4%')).toHaveClass('fs-kpi__delta--success')
  })
})
