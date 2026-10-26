import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { i18n } from '../../src/renderer/src/i18n'
import en from '../../src/renderer/src/i18n/locales/en'
import fr from '../../src/renderer/src/i18n/locales/fr'

type Catalog = { [key: string]: string | Catalog }

const RENDERER_DIR = resolve(import.meta.dirname, '../../src/renderer/src')

function flatten(catalog: Catalog, prefix = ''): Map<string, string> {
  const out = new Map<string, string>()
  for (const [key, value] of Object.entries(catalog)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'string') out.set(path, value)
    else for (const [k, v] of flatten(value, path)) out.set(k, v)
  }
  return out
}

function resolvePath(catalog: Catalog, path: string): string | Catalog | undefined {
  let node: string | Catalog | undefined = catalog
  for (const part of path.split('.')) {
    if (node === undefined || typeof node === 'string') return undefined
    node = node[part]
  }
  return node
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return name === 'locales' ? [] : sourceFiles(path)
    return /\.(vue|ts)$/.test(name) ? [path] : []
  })
}

/** Unique placeholder names; a singular form may legitimately omit `{count}`. */
const placeholders = (message: string): string[] =>
  [...new Set([...message.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!))].sort()

const enMessages = flatten(en as Catalog)
const frMessages = flatten(fr as Catalog)
const sources = sourceFiles(RENDERER_DIR).map((file) => ({ file, text: readFileSync(file, 'utf8') }))

describe('i18n catalogs', () => {
  it('defines the same keys in every language', () => {
    expect([...frMessages.keys()].sort()).toEqual([...enMessages.keys()].sort())
  })

  it('keeps placeholders and plural forms consistent across languages', () => {
    for (const [key, enMessage] of enMessages) {
      const frMessage = frMessages.get(key)!
      expect(placeholders(frMessage).filter((p) => p !== 'n'), key).toEqual(
        placeholders(enMessage).filter((p) => p !== 'n')
      )
      expect(frMessage.split('|').length, key).toBe(enMessage.split('|').length)
    }
  })

  it('resolves every literal key used in the renderer', () => {
    const missing: string[] = []
    for (const { file, text } of sources) {
      const keys = [
        ...text.matchAll(/\b(?:t|te)\(\s*'([\w.-]+)'/g),
        ...text.matchAll(/keypath="([\w.-]+)"/g)
      ].map((m) => m[1]!)
      for (const key of keys) {
        if (typeof resolvePath(en as Catalog, key) !== 'string') missing.push(`${file}: ${key}`)
      }
    }
    expect(missing).toEqual([])
  })

  it('resolves the prefix of every dynamic key used in the renderer', () => {
    const missing: string[] = []
    for (const { file, text } of sources) {
      for (const m of text.matchAll(/\b(?:t|te)\(\s*`([\w.-]+)\.\$\{/g)) {
        const node = resolvePath(en as Catalog, m[1]!)
        if (!node || typeof node === 'string') missing.push(`${file}: ${m[1]}`)
      }
    }
    expect(missing).toEqual([])
  })

  it('compiles and formats every message, including French plurals', () => {
    const { t } = i18n.global
    const params = new Proxy({}, { get: (_target, name) => `<${String(name)}>`, has: () => true })
    for (const locale of ['en', 'fr'] as const) {
      i18n.global.locale.value = locale
      for (const key of enMessages.keys()) {
        const output = t(key, params as Record<string, unknown>)
        expect(output, `${locale}:${key}`).not.toBe(key)
        expect(output, `${locale}:${key}`).not.toMatch(/[{}]/)
      }
    }
    i18n.global.locale.value = 'en'
    expect(t('layout.activeTimers', 0)).toBe('0 active timers')
    expect(t('layout.activeTimers', 1)).toBe('1 active timer')
    expect(t('layout.activeTimers', 2)).toBe('2 active timers')

    // French treats 0 as singular, unlike vue-i18n's default rule.
    i18n.global.locale.value = 'fr'
    expect(t('layout.activeTimers', 0)).toBe('0 chronomètre actif')
    expect(t('layout.activeTimers', 1)).toBe('1 chronomètre actif')
    expect(t('layout.activeTimers', 2)).toBe('2 chronomètres actifs')
    i18n.global.locale.value = 'en'
  })
})
