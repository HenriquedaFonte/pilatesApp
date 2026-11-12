// @vitest-environment node
import { describe, it, expect } from 'vitest'
import pt from '@/locales/pt.json'
import en from '@/locales/en.json'
import fr from '@/locales/fr.json'

// Story 3.7: a Política de Privacidade (texto legal) tem de ter a mesma
// estrutura nas três línguas: mesmas chaves e o mesmo número de itens.
const shape = value => {
  if (Array.isArray(value)) return { length: value.length }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(k => [k, shape(value[k])]))
  }
  return typeof value
}

describe('Política de Privacidade (pt/en/fr)', () => {
  it('mesmas chaves e mesmo número de itens nas três línguas', () => {
    expect(shape(en.privacyPolicy)).toEqual(shape(pt.privacyPolicy))
    expect(shape(fr.privacyPolicy)).toEqual(shape(pt.privacyPolicy))
  })

  it('tem a seção de dados de seguro e recibos, com data fixa de atualização', () => {
    for (const locale of [pt, en, fr]) {
      const pp = locale.privacyPolicy
      expect(pp.insuranceReceipts.title).toMatch(/^8\. /)
      expect(pp.insuranceReceipts.items.length).toBeGreaterThan(0)
      expect(pp.insuranceReceipts.items.join(' ')).toMatch(/\b6\b/)
      expect(pp.contact.title).toMatch(/^13\. /)
      expect(pp.lastUpdatedDate).toMatch(/2026/)
    }
  })
})
