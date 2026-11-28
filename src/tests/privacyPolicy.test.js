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
      expect(pp.insuranceReceipts.items.join(' ')).toMatch(/\b14\b/)
      expect(pp.contact.title).toMatch(/^14\. /)
      expect(pp.lastUpdatedDate).toMatch(/2026/)
    }
  })

  // B2 (docs/legal/termo-e-ficha-v1.md): seção 9 nova, seção 10 = transferências
  // (o consentimento de saúde v1, imutável, remete à "seção 10" para as cópias
  // de segurança) e responsável pela proteção dos dados no contato.
  it('tem a seção 9 da ficha de saúde e do termo, e a seção 10 com as cópias de segurança', () => {
    for (const locale of [pt, en, fr]) {
      const pp = locale.privacyPolicy
      expect(pp.healthProfileAndAgreement.title).toMatch(/^9\. /)
      expect(pp.healthProfileAndAgreement.items).toHaveLength(6)
      expect(pp.healthProfileAndAgreement.items.join(' ')).toMatch(/Montréal, Québec/)
      expect(pp.internationalTransfers.title).toMatch(/^10\. /)
      expect(pp.internationalTransfers.content).toMatch(/GitHub.*90/)
      expect(pp.dataRetention.healthContent).toMatch(/\b5\b/)
      expect(pp.dataSecurity.healthContent.length).toBeGreaterThan(0)
      expect(pp.childrenPrivacy.title).toMatch(/^11\. /)
      expect(pp.lastUpdatedDate).toMatch(/28/)
    }
  })

  it('tem a responsável pela proteção dos dados e o endereço no contato', () => {
    const label = {
      pt: /^Responsável pela proteção dos dados pessoais: Josiane da Silveira Malamud/,
      en: /^Person in charge of the protection of personal information: Josiane da Silveira Malamud/,
      fr: /^Responsable de la protection des renseignements personnels : Josiane da Silveira Malamud/,
    }
    for (const [code, locale] of Object.entries({ pt, en, fr })) {
      const items = locale.privacyPolicy.contact.items
      expect(items[0]).toMatch(label[code])
      expect(items[0]).toMatch(/josipilatesmontreal@gmail\.com/)
      expect(items.join(' ')).toMatch(/10145, avenue Hamel, Montréal \(Québec\)/)
    }
  })
})
