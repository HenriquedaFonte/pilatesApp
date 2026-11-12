import { describe, it, expect } from 'vitest'
import {
  countByLanguage,
  excludeStudents,
  searchStudents,
  sendKindOf,
  normalizeTemplateParam,
  canAdvance,
  messagePreview,
  studentLanguage
} from '../lib/emailRecipients'

const students = [
  { id: 'a', full_name: 'Ana Lúcia', email: 'ana@x.com', preferred_language: 'pt' },
  { id: 'b', full_name: 'Bob', email: 'bob@x.com', preferred_language: 'en' },
  { id: 'c', full_name: 'Céline', email: 'celine@x.com', preferred_language: 'fr' },
  { id: 'd', full_name: 'Duda', email: 'duda@x.com', preferred_language: null },
  { id: 'e', full_name: 'Eva', email: 'eva@x.com', preferred_language: 'es' }
]

describe('countByLanguage', () => {
  it('conta pt/en/fr; sem língua ou língua desconhecida conta como pt', () => {
    expect(countByLanguage(students)).toEqual({ pt: 3, en: 1, fr: 1 })
    expect(studentLanguage(students[3])).toBe('pt')
  })
  it('lista vazia', () => {
    expect(countByLanguage([])).toEqual({ pt: 0, en: 0, fr: 0 })
  })
})

describe('excludeStudents', () => {
  it('tira os ids removidos à mão', () => {
    expect(excludeStudents(students, ['b', 'c']).map(s => s.id)).toEqual(['a', 'd', 'e'])
  })
  it('sem removidos devolve a mesma lista', () => {
    expect(excludeStudents(students, [])).toBe(students)
  })
})

describe('searchStudents', () => {
  it('busca por nome sem acento e sem maiúscula', () => {
    expect(searchStudents(students, 'lucia').map(s => s.id)).toEqual(['a'])
    expect(searchStudents(students, 'CELINE').map(s => s.id)).toEqual(['c'])
  })
  it('busca por email', () => {
    expect(searchStudents(students, 'bob@').map(s => s.id)).toEqual(['b'])
  })
  it('termo vazio devolve todos', () => {
    expect(searchStudents(students, '  ')).toBe(students)
  })
})

describe('sendKindOf / normalizeTemplateParam', () => {
  it('modelos automáticos e mensagem escrita', () => {
    expect(sendKindOf('lowCredits')).toBe('low_credits')
    expect(sendKindOf('consentForm')).toBe('consent')
    expect(sendKindOf('profileUpdate')).toBe('custom')
    expect(sendKindOf('blank')).toBe('custom')
  })
  it('links antigos do relatório de créditos viram o modelo de créditos', () => {
    expect(normalizeTemplateParam('zeroCredits')).toBe('lowCredits')
    expect(normalizeTemplateParam('zero_credits')).toBe('lowCredits')
    expect(normalizeTemplateParam('profileUpdate')).toBe('profileUpdate')
    expect(normalizeTemplateParam(null)).toBe(null)
  })
})

describe('canAdvance', () => {
  it('passo 1 precisa de destinatário e turma carregada', () => {
    expect(canAdvance(1, { recipientsCount: 0 })).toBe(false)
    expect(canAdvance(1, { recipientsCount: 3, loading: true })).toBe(false)
    expect(canAdvance(1, { recipientsCount: 3 })).toBe(true)
  })
  it('passo 2 precisa de modelo; mensagem escrita precisa de assunto e texto', () => {
    expect(canAdvance(2, {})).toBe(false)
    expect(canAdvance(2, { templateId: 'blank', content: { pt: { subject: 'Oi', message: ' ' } } })).toBe(false)
    expect(canAdvance(2, { templateId: 'blank', content: { pt: { subject: 'Oi', message: 'Texto' } } })).toBe(true)
    expect(canAdvance(2, { templateId: 'blank', content: { fr: { subject: 'Salut', message: 'Texte' } } })).toBe(true)
    expect(canAdvance(2, { templateId: 'lowCredits' })).toBe(true)
    expect(canAdvance(2, { templateId: 'consentForm' })).toBe(true)
  })
})

describe('messagePreview', () => {
  it('junta linhas e corta com reticências', () => {
    expect(messagePreview('Olá\n\nturma', 50)).toBe('Olá turma')
    expect(messagePreview('a'.repeat(10), 5)).toBe('aaaaa…')
  })
})
