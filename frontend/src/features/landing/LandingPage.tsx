import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Badge,
  Button,
  Chip,
  Clock,
  Flame,
  Grid,
  ProductCard,
  Skeleton,
  Sliders,
} from '../../design-system'
import { CustomerFooter } from '../../app/layouts/CustomerFooter'
import { useAddToCart } from '../cart/useAddToCart'
import { useMenu, useMoney } from '../shared/queries'
import './LandingPage.css'

export function LandingPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const money = useMoney()
  const addToCart = useAddToCart()
  const { data: menu } = useMenu()
  const [category, setCategory] = useState('all')

  const featured = menu?.flatMap((section) => section.products).filter((p) => p.isFeatured) ?? []
  const hero = featured[0]
  const popular = (
    category === 'all'
      ? featured
      : (menu?.find((section) => section.category.slug === category)?.products ?? [])
  ).slice(0, 4)

  return (
    <div className="fs-landing">
      <section className="fs-landing__hero">
        <div className="fs-landing__copy">
          <Link to="/menu" className="fs-landing__announce">
            <Badge tone="brand">{t('landing.new')}</Badge>
            <span>{t('landing.announce', { name: hero?.name ?? '…' })}</span>
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <h1 className="t-display-xl">
            {t('landing.headline1')}
            <br />
            <em>{t('landing.headline2')}</em>
          </h1>
          <p className="t-body-l">{t('landing.lede')}</p>
          <div className="fs-landing__ctas">
            <Button size="L" icon={ArrowRight} onClick={() => navigate('/menu')}>
              {t('landing.orderNow')}
            </Button>
            <Button size="L" variant="secondary" onClick={() => navigate('/menu')}>
              {t('landing.browse')}
            </Button>
          </div>
        </div>
        <div className="fs-landing__visual" aria-hidden="true">
          <span className="fs-landing__blob" />
          <img src={hero?.image ?? '/menu/overkill-double.jpg'} alt="" />
          {hero && (
            <div className="fs-landing__float">
              <Flame size={20} />
              <span>
                <strong>{hero.name}</strong>
                <span>{t('landing.topSeller', { price: money(hero.price) })}</span>
              </span>
            </div>
          )}
        </div>
      </section>

      <section className="fs-landing__section" aria-labelledby="shop-by-category">
        <div className="fs-landing__section-head">
          <div>
            <p className="t-overline">{t('landing.explore')}</p>
            <h2 id="shop-by-category" className="t-h2">
              {t('landing.shopByCategory')}
            </h2>
          </div>
          <Button variant="ghost" icon={ArrowRight} onClick={() => navigate('/menu')}>
            {t('landing.viewAll')}
          </Button>
        </div>
        <ul className="fs-landing__tiles">
          {menu
            ? menu.map((section) => (
                <li key={section.category.slug}>
                  <Link to="/menu">
                    <img src={section.products[0]?.image} alt="" />
                    <span>
                      <strong>{section.category.name}</strong>
                      <span>{t('menu.itemCount', { count: section.products.length })}</span>
                    </span>
                  </Link>
                </li>
              ))
            : Array.from({ length: 4 }, (_, i) => (
                <li key={i}>
                  <Skeleton style={{ height: 80, borderRadius: 16 }} />
                </li>
              ))}
        </ul>
      </section>

      <section className="fs-landing__popular" aria-labelledby="popular-title">
        <div className="fs-landing__section-head">
          <div>
            <p className="t-overline">{t('landing.mostOrdered')}</p>
            <h2 id="popular-title" className="t-h2">
              {t('landing.popular')}
            </h2>
          </div>
          <div className="fs-landing__chips" role="group" aria-label={t('menu.categories')}>
            <Chip active={category === 'all'} onClick={() => setCategory('all')}>
              {t('menu.all')}
            </Chip>
            {menu?.map(({ category: c }) => (
              <Chip key={c.slug} active={category === c.slug} onClick={() => setCategory(c.slug)}>
                {c.name}
              </Chip>
            ))}
          </div>
        </div>
        <div className="fs-landing__cards">
          {popular.map((product) => (
            <ProductCard
              key={product.id}
              name={product.name}
              description={product.description}
              price={money(product.price)}
              meta={
                product.prepTimeMin && product.prepTimeMax
                  ? t('product.prep', { min: product.prepTimeMin, max: product.prepTimeMax })
                  : undefined
              }
              image={product.image}
              addLabel={t('common.addToCart')}
              onAdd={() => addToCart(product)}
              onSelect={() => navigate(`/menu/${product.id}`)}
            />
          ))}
        </div>
      </section>

      <section className="fs-landing__how" aria-labelledby="how-title">
        <p className="t-overline">{t('landing.howLabel')}</p>
        <h2 id="how-title" className="t-h1">
          {t('landing.howTitle')}
        </h2>
        <ol>
          {[
            { icon: Grid, key: 'pick' },
            { icon: Sliders, key: 'customize' },
            { icon: Clock, key: 'track' },
          ].map(({ icon: Icon, key }, index) => (
            <li key={key}>
              <div>
                <span className="fs-landing__step-icon">
                  <Icon size={24} aria-hidden="true" />
                </span>
                <span className="fs-landing__step-num">{String(index + 1).padStart(2, '0')}</span>
              </div>
              <h3 className="t-h4">{t(`landing.steps.${key}.title`)}</h3>
              <p>{t(`landing.steps.${key}.body`)}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="fs-landing__promo" aria-labelledby="promo-title">
        <div>
          <Badge tone="brand">{t('landing.limited')}</Badge>
          <h2 id="promo-title" className="t-h1">
            {t('landing.promoTitle')}
          </h2>
          <p className="t-body-l">{t('landing.promoBody', { code: 'FOODSTACK20' })}</p>
          <Button size="L" icon={ArrowRight} onClick={() => navigate('/signup')}>
            {t('landing.createAccount')}
          </Button>
        </div>
        <div className="fs-landing__promo-photos" aria-hidden="true">
          <img src="/menu/bbq-bacon.jpg" alt="" />
          <img src="/menu/burrito-stack.jpg" alt="" />
        </div>
      </section>

      <CustomerFooter />
    </div>
  )
}
