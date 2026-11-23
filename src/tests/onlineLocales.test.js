// @vitest-environment node
import { describe, it, expect } from 'vitest'
import pt from '@/locales/pt.json'
import en from '@/locales/en.json'
import fr from '@/locales/fr.json'

// Turma online: o bloco `online` tem de ter as mesmas chaves nas três línguas.
const shape = value => {
  if (Array.isArray(value)) return { length: value.length }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(k => [k, shape(value[k])]))
  }
  return typeof value
}

const leaves = (value, prefix = '') =>
  value && typeof value === 'object'
    ? Object.entries(value).flatMap(([k, v]) => leaves(v, `${prefix}${k}.`))
    : [[prefix.slice(0, -1), value]]

describe('textos da turma online (pt/en/fr)', () => {
  it('mesmas chaves nas três línguas', () => {
    expect(shape(en.online)).toEqual(shape(pt.online))
    expect(shape(fr.online)).toEqual(shape(pt.online))
  })

  it('nenhum texto vazio e mesmos {{variáveis}} em cada chave', () => {
    const vars = s => (String(s).match(/{{\w+}}/g) || []).sort().join(',')
    const ptLeaves = Object.fromEntries(leaves(pt.online))
    for (const locale of [pt, en, fr]) {
      for (const [key, value] of leaves(locale.online)) {
        expect(String(value).trim(), key).not.toBe('')
        expect(vars(value), key).toBe(vars(ptLeaves[key]))
      }
    }
  })

  it('tem a chave de erro online_invalid_status', () => {
    for (const locale of [pt, en, fr]) expect(locale.online.errors.invalid_status).toBeTruthy()
  })
})
