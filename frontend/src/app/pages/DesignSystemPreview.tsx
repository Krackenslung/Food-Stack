import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ArrowRight,
  Badge,
  Button,
  Chip,
  Input,
  KpiCard,
  Mail,
  ProductCard,
  Stepper,
} from '../../design-system'
import type { BadgeTone } from '../../design-system'

const TONES: BadgeTone[] = ['success', 'warning', 'danger', 'info', 'neutral', 'brand']

/** Development-only visual QA page (route /_design-system): every component, both themes via the toggle. */
export function DesignSystemPreview() {
  const { t } = useTranslation()
  const [qty, setQty] = useState(1)
  const [chip, setChip] = useState(0)

  return (
    <section
      style={{
        display: 'grid',
        justifyItems: 'start',
        gap: 'var(--space-32)',
        padding: 'var(--space-32)',
      }}
    >
      <h1 className="t-h1">Design system</h1>

      <div
        style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-16)', alignItems: 'center' }}
      >
        <Button>Button</Button>
        <Button size="L" icon={ArrowRight}>
          Button
        </Button>
        <Button variant="secondary">Button</Button>
        <Button variant="secondary" size="L">
          Button
        </Button>
        <Button variant="ghost">Button</Button>
        <Button variant="dark">Button</Button>
        <Button variant="dark" size="L">
          Button
        </Button>
        <Button disabled>Disabled</Button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-12)' }}>
        {TONES.map((tone) => (
          <Badge key={tone} tone={tone}>
            Status
          </Badge>
        ))}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-12)' }}>
        {['All', 'Burgers', 'Burritos', 'Sides'].map((label, index) => (
          <Chip key={label} active={chip === index} onClick={() => setChip(index)}>
            {label}
          </Chip>
        ))}
      </div>

      <div
        style={{
          display: 'grid',
          gap: 'var(--space-24)',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 360px))',
        }}
      >
        <Input
          label="Email address"
          placeholder="you@example.com"
          icon={Mail}
          helper="Helper text"
        />
        <Input
          label="Email address"
          defaultValue="you@example.com"
          icon={Mail}
          error="Helper text"
        />
      </div>

      <Stepper
        value={qty}
        onChange={setQty}
        min={1}
        decrementLabel={t('common.decrease')}
        incrementLabel={t('common.increase')}
      />

      <div
        style={{
          display: 'grid',
          gap: 'var(--space-24)',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 284px))',
        }}
      >
        <ProductCard
          name="BBQ Bacon Burger"
          description="Smoky bacon, cheddar and house BBQ"
          price="$11.49"
          meta="620 kcal"
          rating="4.8"
          image="/menu/bbq-bacon.jpg"
          addLabel={t('common.addToCart')}
        />
        <KpiCard label="Revenue today" value="$4,286" delta="▲ 12.4%" period="vs. last week" />
      </div>
    </section>
  )
}
