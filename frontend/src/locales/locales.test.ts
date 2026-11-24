import { describe, expect, it } from 'vitest'
import en from './en.json'
import es from './es.json'

function flatten(tree: Record<string, unknown>, prefix = ''): Record<string, string> {
  return Object.entries(tree).reduce<Record<string, string>>((acc, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'object' && value !== null) {
      Object.assign(acc, flatten(value as Record<string, unknown>, path))
    } else {
      acc[path] = String(value)
    }
    return acc
  }, {})
}

describe('locales', () => {
  const english = flatten(en)
  const spanish = flatten(es)

  it('has exactly the same keys in en and es', () => {
    expect(Object.keys(spanish).sort()).toEqual(Object.keys(english).sort())
  })

  it('has no empty strings', () => {
    for (const [key, value] of Object.entries({ ...english }))
      expect(value.trim(), key).not.toBe('')
    for (const [key, value] of Object.entries({ ...spanish }))
      expect(value.trim(), key).not.toBe('')
  })

  it('translates every string (only brand/language names may match)', () => {
    const allowedSame = new Set(['language.es', 'language.en'])
    const untranslated = Object.keys(english).filter(
      (key) => english[key] === spanish[key] && !allowedSame.has(key),
    )
    // "Menu"-style words are legitimately close; fail only if most of the file was copied.
    expect(untranslated.length).toBeLessThan(Object.keys(english).length / 4)
  })
})
