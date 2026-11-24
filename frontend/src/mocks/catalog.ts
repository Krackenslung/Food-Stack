/**
 * Demo catalog for the mock API (CLAUDE.md "Seed catalog": 17 products in 4 categories).
 * Prices and copy for the products drawn in Figma come from the design; the rest are placeholders.
 */
import type { Language } from '../lib/language'

type Bilingual = Record<Language, string>

export type MockIngredient = {
  name: Bilingual
  extraPrice: string
  default: number
  max: number
  removable: boolean
}

export type MockProduct = {
  id: number
  category: 'burgers' | 'burritos' | 'sides' | 'beverages'
  price: string
  calories: number
  prepTimeMin: number
  prepTimeMax: number
  image: string
  featured: boolean
  name: Bilingual
  description: Bilingual
  allowCustomization: boolean
  ingredients: MockIngredient[]
}

export const MOCK_CATEGORIES = [
  { id: 1, slug: 'burgers', name: { en: 'Burgers', es: 'Hamburguesas' } },
  { id: 2, slug: 'burritos', name: { en: 'Burritos', es: 'Burritos' } },
  { id: 3, slug: 'sides', name: { en: 'Sides', es: 'Acompañamientos' } },
  { id: 4, slug: 'beverages', name: { en: 'Beverages', es: 'Bebidas' } },
] as const

const burgerIngredients: MockIngredient[] = [
  {
    name: { en: 'Angus beef patty', es: 'Carne Angus' },
    extraPrice: '2.50',
    default: 1,
    max: 3,
    removable: false,
  },
  {
    name: { en: 'Aged cheddar', es: 'Queso cheddar añejo' },
    extraPrice: '1.00',
    default: 1,
    max: 3,
    removable: true,
  },
  {
    name: { en: 'Crispy bacon', es: 'Tocino crujiente' },
    extraPrice: '1.50',
    default: 0,
    max: 2,
    removable: true,
  },
  {
    name: { en: 'Caramelized onions', es: 'Cebolla caramelizada' },
    extraPrice: '0.00',
    default: 1,
    max: 2,
    removable: true,
  },
  {
    name: { en: 'Pickles', es: 'Pepinillos' },
    extraPrice: '0.00',
    default: 1,
    max: 2,
    removable: true,
  },
  {
    name: { en: 'Jalapeños', es: 'Jalapeños' },
    extraPrice: '0.50',
    default: 0,
    max: 3,
    removable: true,
  },
]

const burritoIngredients: MockIngredient[] = [
  {
    name: { en: 'Rice', es: 'Arroz' },
    extraPrice: '0.00',
    default: 1,
    max: 2,
    removable: true,
  },
  {
    name: { en: 'Black beans', es: 'Frijoles negros' },
    extraPrice: '0.00',
    default: 1,
    max: 2,
    removable: true,
  },
  {
    name: { en: 'Guacamole', es: 'Guacamole' },
    extraPrice: '1.50',
    default: 0,
    max: 2,
    removable: true,
  },
  {
    name: { en: 'Salsa', es: 'Salsa' },
    extraPrice: '0.00',
    default: 1,
    max: 3,
    removable: true,
  },
  {
    name: { en: 'Sour cream', es: 'Crema' },
    extraPrice: '0.75',
    default: 0,
    max: 2,
    removable: true,
  },
]

type Seed = Omit<MockProduct, 'ingredients' | 'allowCustomization'> & {
  custom?: 'burger' | 'burrito'
}

const seeds: Seed[] = [
  {
    id: 1,
    category: 'burgers',
    price: '12.99',
    calories: 980,
    prepTimeMin: 15,
    prepTimeMax: 20,
    image: '/menu/overkill-double.jpg',
    featured: true,
    custom: 'burger',
    name: { en: 'Overkill Double Burger', es: 'Hamburguesa Overkill Doble' },
    description: {
      en: 'Two smashed patties, double cheddar, house sauce.',
      es: 'Dos carnes aplastadas, doble cheddar y salsa de la casa.',
    },
  },
  {
    id: 2,
    category: 'burgers',
    price: '11.49',
    calories: 820,
    prepTimeMin: 15,
    prepTimeMax: 20,
    image: '/menu/bbq-bacon.jpg',
    featured: false,
    custom: 'burger',
    name: { en: 'BBQ Bacon Burger', es: 'Hamburguesa BBQ con Tocino' },
    description: {
      en: 'Smoky BBQ sauce, crispy bacon and aged cheddar.',
      es: 'Salsa BBQ ahumada, tocino crujiente y cheddar añejo.',
    },
  },
  {
    id: 3,
    category: 'burgers',
    price: '10.49',
    calories: 760,
    prepTimeMin: 12,
    prepTimeMax: 18,
    image: '/menu/stack-burger.jpg',
    featured: false,
    custom: 'burger',
    name: { en: 'Stack Burger', es: 'Hamburguesa Stack' },
    description: {
      en: 'Our signature stack with lettuce, tomato and pickles.',
      es: 'Nuestra clásica con lechuga, jitomate y pepinillos.',
    },
  },
  {
    id: 4,
    category: 'burgers',
    price: '10.99',
    calories: 790,
    prepTimeMin: 12,
    prepTimeMax: 18,
    image: '/menu/spicy-burger.jpg',
    featured: false,
    custom: 'burger',
    name: { en: 'Spicy Burger', es: 'Hamburguesa Picante' },
    description: {
      en: 'Pepper jack, jalapeños and a chipotle kick.',
      es: 'Queso pepper jack, jalapeños y un toque de chipotle.',
    },
  },
  {
    id: 5,
    category: 'burritos',
    price: '7.99',
    calories: 720,
    prepTimeMin: 10,
    prepTimeMax: 15,
    image: '/menu/burrito-stack.jpg',
    featured: true,
    custom: 'burrito',
    name: { en: 'Burrito Stack', es: 'Burrito Stack' },
    description: {
      en: 'Loaded with rice, beans, salsa and grilled steak.',
      es: 'Con arroz, frijoles, salsa y arrachera a la parrilla.',
    },
  },
  {
    id: 6,
    category: 'burritos',
    price: '8.49',
    calories: 690,
    prepTimeMin: 10,
    prepTimeMax: 15,
    image: '/menu/chicken-burrito.jpg',
    featured: true,
    custom: 'burrito',
    name: { en: 'Chicken Burrito', es: 'Burrito de Pollo' },
    description: {
      en: 'Grilled chicken, beans and creamy chipotle sauce.',
      es: 'Pollo a la parrilla, frijoles y cremosa salsa chipotle.',
    },
  },
  {
    id: 7,
    category: 'burritos',
    price: '8.99',
    calories: 740,
    prepTimeMin: 10,
    prepTimeMax: 15,
    image: '/menu/spicy-beef-burrito.jpg',
    featured: false,
    custom: 'burrito',
    name: { en: 'Spicy Beef Burrito', es: 'Burrito de Res Picante' },
    description: {
      en: 'Seasoned beef, pepper jack and fiery salsa roja.',
      es: 'Res sazonada, queso pepper jack y salsa roja picosa.',
    },
  },
  {
    id: 8,
    category: 'burritos',
    price: '7.49',
    calories: 610,
    prepTimeMin: 10,
    prepTimeMax: 15,
    image: '/menu/veggie-burrito.jpg',
    featured: false,
    custom: 'burrito',
    name: { en: 'Veggie Burrito', es: 'Burrito Vegetariano' },
    description: {
      en: 'Grilled peppers, beans, rice and fresh guacamole.',
      es: 'Pimientos asados, frijoles, arroz y guacamole fresco.',
    },
  },
  {
    id: 9,
    category: 'sides',
    price: '4.79',
    calories: 450,
    prepTimeMin: 6,
    prepTimeMax: 8,
    image: '/menu/cheese-bites.jpg',
    featured: false,
    name: { en: 'Cheese Bites', es: 'Bocados de Queso' },
    description: {
      en: 'Golden, crunchy bites with melty cheese inside.',
      es: 'Bocados dorados y crujientes con queso derretido.',
    },
  },
  {
    id: 10,
    category: 'sides',
    price: '3.49',
    calories: 380,
    prepTimeMin: 5,
    prepTimeMax: 7,
    image: '/menu/fries.jpg',
    featured: false,
    name: { en: 'Fries', es: 'Papas a la Francesa' },
    description: {
      en: 'Crispy fries with sea salt.',
      es: 'Papas crujientes con sal de mar.',
    },
  },
  {
    id: 11,
    category: 'sides',
    price: '4.29',
    calories: 410,
    prepTimeMin: 6,
    prepTimeMax: 8,
    image: '/menu/onion-rings.jpg',
    featured: false,
    name: { en: 'Onion Rings', es: 'Aros de Cebolla' },
    description: {
      en: 'Thick-cut rings in a golden beer batter.',
      es: 'Aros gruesos en un dorado rebozado de cerveza.',
    },
  },
  {
    id: 12,
    category: 'sides',
    price: '5.49',
    calories: 520,
    prepTimeMin: 6,
    prepTimeMax: 9,
    image: '/menu/nachos.jpg',
    featured: false,
    name: { en: 'Nachos', es: 'Nachos' },
    description: {
      en: 'Tortilla chips with queso, jalapeños and pico de gallo.',
      es: 'Totopos con queso, jalapeños y pico de gallo.',
    },
  },
  {
    id: 13,
    category: 'beverages',
    price: '3.49',
    calories: 260,
    prepTimeMin: 1,
    prepTimeMax: 2,
    image: '/menu/iced-horchata.jpg',
    featured: false,
    name: { en: 'Iced Horchata', es: 'Horchata Helada' },
    description: {
      en: 'Sweet cinnamon rice milk served over ice.',
      es: 'Dulce leche de arroz con canela servida con hielo.',
    },
  },
  {
    id: 14,
    category: 'beverages',
    price: '4.99',
    calories: 540,
    prepTimeMin: 4,
    prepTimeMax: 5,
    image: '/menu/classic-milkshake.jpg',
    featured: true,
    name: { en: 'Classic Milkshake', es: 'Malteada Clásica' },
    description: {
      en: 'Vanilla bean shake topped with whipped cream.',
      es: 'Malteada de vainilla con crema batida.',
    },
  },
  {
    id: 15,
    category: 'beverages',
    price: '2.99',
    calories: 120,
    prepTimeMin: 1,
    prepTimeMax: 2,
    image: '/menu/lemonade.jpg',
    featured: false,
    name: { en: 'Lemonade', es: 'Limonada' },
    description: {
      en: 'Fresh-squeezed lemonade over ice.',
      es: 'Limonada recién exprimida con hielo.',
    },
  },
  {
    id: 16,
    category: 'beverages',
    price: '2.79',
    calories: 90,
    prepTimeMin: 1,
    prepTimeMax: 2,
    image: '/menu/iced-tea.jpg',
    featured: false,
    name: { en: 'Iced Tea', es: 'Té Helado' },
    description: {
      en: 'Black tea, brewed daily and lightly sweetened.',
      es: 'Té negro preparado a diario, ligeramente dulce.',
    },
  },
  {
    id: 17,
    category: 'beverages',
    price: '2.49',
    calories: 150,
    prepTimeMin: 1,
    prepTimeMax: 1,
    image: '/menu/soda.jpg',
    featured: false,
    name: { en: 'Soda', es: 'Refresco' },
    description: {
      en: 'Ice-cold fountain soda.',
      es: 'Refresco de fuente bien frío.',
    },
  },
]

export const MOCK_PRODUCTS: MockProduct[] = seeds.map(({ custom, ...product }) => ({
  ...product,
  allowCustomization: Boolean(custom),
  ingredients:
    custom === 'burger' ? burgerIngredients : custom === 'burrito' ? burritoIngredients : [],
}))

/** Stable id per (product, ingredient slot): Product_Ingredients.Id in the real schema. */
export function productIngredientId(productId: number, index: number): number {
  return productId * 100 + index + 1
}
