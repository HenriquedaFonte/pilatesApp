// @vitest-environment node
import { describe, it, expect } from 'vitest'
import pt from '@/locales/pt.json'
import en from '@/locales/en.json'
import fr from '@/locales/fr.json'

// Termo e ficha de saúde: os blocos `consent` e `healthProfile` têm de ter as
// mesmas chaves e as mesmas {{variáveis}} nas três línguas.
const leaves = (value, prefix = '') =>
  value && typeof value === 'object'
    ? Object.entries(value).flatMap(([k, v]) => leaves(v, `${prefix}${k}.`))
    : [[prefix.slice(0, -1), value]]
const vars = s => (String(s).match(/{{\w+}}/g) || []).sort().join(',')

describe.each(['consent', 'healthProfile'])('textos de %s (pt/en/fr)', block => {
  const ptLeaves = Object.fromEntries(leaves(pt[block]))

  it('mesmas chaves nas três línguas', () => {
    for (const locale of [en, fr]) {
      expect(Object.keys(Object.fromEntries(leaves(locale[block]))).sort()).toEqual(
        Object.keys(ptLeaves).sort()
      )
    }
  })

  it('nenhum texto vazio e mesmas variáveis', () => {
    for (const locale of [pt, en, fr]) {
      for (const [key, value] of leaves(locale[block])) {
        expect(String(value).trim(), key).not.toBe('')
        expect(vars(value), key).toBe(vars(ptLeaves[key]))
      }
    }
  })
})

describe('códigos de erro do banco', () => {
  it('cada código consent_* tem texto nas três línguas', () => {
    const codes = ['not_allowed', 'invalid_language', 'version_not_found', 'version_outdated', 'invalid_name', 'invalid_student', 'invalid_date', 'already_accepted', 'immutable', 'version_locked', 'invalid_reason', 'invalid_weeks', 'generic']
    for (const locale of [pt, en, fr]) for (const c of codes) expect(locale.consent.errors[c], c).toBeTruthy()
  })
})

describe('exclusão permanente com ficha de saúde (PR D, 12b)', () => {
  it('texto do erro STUDENT_HAS_HEALTH_PROFILE nas três línguas', () => {
    for (const locale of [pt, en, fr]) {
      expect(String(locale.teacher.students.hardDeleteDialog.hasHealthProfile || '').trim()).not.toBe('')
    }
  })
})
