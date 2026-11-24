import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { useCartStore } from '../features/cart/cartStore'
import i18n from '../lib/i18n'

// Newer Node versions ship an experimental global `localStorage` that shadows jsdom's and is
// unusable without --localstorage-file. Tests always get a plain in-memory Storage instead.
class MemoryStorage implements Storage {
  private data = new Map<string, string>()

  get length() {
    return this.data.size
  }
  clear() {
    this.data.clear()
  }
  getItem(key: string) {
    return this.data.has(key) ? (this.data.get(key) as string) : null
  }
  key(index: number) {
    return Array.from(this.data.keys())[index] ?? null
  }
  removeItem(key: string) {
    this.data.delete(key)
  }
  setItem(key: string, value: string) {
    this.data.set(key, String(value))
  }
}

const storage = new MemoryStorage()
for (const target of [window, globalThis]) {
  Object.defineProperty(target, 'localStorage', { value: storage, configurable: true })
}

afterEach(async () => {
  cleanup()
  storage.clear()
  useCartStore.setState({ items: [], promoCode: '', fulfillmentType: 'pickup' })
  if (i18n.language !== 'en') await i18n.changeLanguage('en')
  document.documentElement.removeAttribute('data-theme')
})

// jsdom has no matchMedia.
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList
}
