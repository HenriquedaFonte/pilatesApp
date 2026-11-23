import { describe, it, expect } from 'vitest'
import {
  filterRecipients,
  getLowCreditsStudents,
  summarizeRecipients,
  groupEmailHistory
} from '../lib/emailRecipients'

const students = [
  { id: 'a', full_name: 'Ana', individual_credits: 0, duo_credits: 0, group_credits: 0, is_active: true },
  { id: 'b', full_name: 'Bia', individual_credits: 2, duo_credits: 0, group_credits: 0, is_active: true },
  { id: 'c', full_name: 'Caio', individual_credits: 5, duo_credits: 3, group_credits: 2 },
  { id: 'd', full_name: 'Duda', individual_credits: 0, duo_credits: 0, group_credits: 1, is_active: false }
]
const ids = list => list.map(s => s.id)

describe('filterRecipients', () => {
  it('todos: só ativos por padrão (is_active vazio conta como ativo)', () => {
    expect(ids(filterRecipients(students, { filterType: 'all' }))).toEqual(['a', 'b', 'c'])
  })

  it('incluir inativos traz de volta', () => {
    expect(ids(filterRecipients(students, { filterType: 'all', includeInactive: true }))).toEqual(['a', 'b', 'c', 'd'])
  })

  it('turma: só os alunos da turma, sem inativos', () => {
    expect(ids(filterRecipients(students, { filterType: 'class', classStudentIds: ['b', 'd'] }))).toEqual(['b'])
    expect(
      ids(filterRecipients(students, { filterType: 'class', classStudentIds: ['b', 'd'], includeInactive: true }))
    ).toEqual(['b', 'd'])
  })

  it('turma sem escolha (ou turma vazia) → ninguém, nunca todos', () => {
    expect(filterRecipients(students, { filterType: 'class', classStudentIds: null })).toEqual([])
    expect(filterRecipients(students, { filterType: 'class', classStudentIds: [] })).toEqual([])
  })

  it('créditos baixos e zerados', () => {
    expect(ids(filterRecipients(students, { filterType: 'low_credits', lowCreditsThreshold: 3 }))).toEqual(['a', 'b'])
    expect(ids(filterRecipients(students, { filterType: 'zero_credits' }))).toEqual(['a'])
    expect(
      ids(filterRecipients(students, { filterType: 'low_credits', lowCreditsThreshold: 3, includeInactive: true }))
    ).toEqual(['a', 'b', 'd'])
  })

  it('seleção manual e filtro desconhecido', () => {
    expect(ids(filterRecipients(students, { filterType: 'selected', selectedIds: ['c', 'd'] }))).toEqual(['c'])
    expect(filterRecipients(students, { filterType: 'registration_day' })).toEqual([])
  })

  it('disparo rápido de saldo baixo também tira inativos', () => {
    expect(ids(getLowCreditsStudents(students, 3))).toEqual(['a', 'b'])
    expect(ids(getLowCreditsStudents(students, 3, true))).toEqual(['a', 'b', 'd'])
  })

  describe('alunos só online (onlineOnlyIds)', () => {
    // e: só online (0 créditos); a: presencial + online fica de fora da lista
    // onlineOnlyIds (quem decide é isOnlineOnly na tela).
    const withOnline = [
      ...students,
      { id: 'e', full_name: 'Eva', individual_credits: 0, duo_credits: 0, group_credits: 0, is_active: true }
    ]
    const opts = { onlineOnlyIds: ['e'] }

    it('só online sai de créditos baixos e zerados', () => {
      expect(ids(filterRecipients(withOnline, { filterType: 'low_credits', lowCreditsThreshold: 3 }))).toEqual(['a', 'b', 'e'])
      expect(ids(filterRecipients(withOnline, { filterType: 'low_credits', lowCreditsThreshold: 3, ...opts }))).toEqual(['a', 'b'])
      expect(ids(filterRecipients(withOnline, { filterType: 'zero_credits' }))).toEqual(['a', 'e'])
      expect(ids(filterRecipients(withOnline, { filterType: 'zero_credits', ...opts }))).toEqual(['a'])
    })

    it('presencial + online (fora de onlineOnlyIds) continua nos avisos de créditos', () => {
      expect(ids(filterRecipients(withOnline, { filterType: 'zero_credits', ...opts }))).toContain('a')
      expect(ids(filterRecipients(withOnline, { filterType: 'low_credits', lowCreditsThreshold: 3, ...opts }))).toContain('b')
    })

    it('grupos todos, turma e seleção não mudam', () => {
      expect(ids(filterRecipients(withOnline, { filterType: 'all', ...opts }))).toEqual(['a', 'b', 'c', 'e'])
      expect(ids(filterRecipients(withOnline, { filterType: 'class', classStudentIds: ['b', 'e'], ...opts }))).toEqual(['b', 'e'])
      expect(ids(filterRecipients(withOnline, { filterType: 'selected', selectedIds: ['e'], ...opts }))).toEqual(['e'])
    })

    it('lista vazia ou nula = comportamento de antes', () => {
      expect(ids(filterRecipients(withOnline, { filterType: 'zero_credits', onlineOnlyIds: null }))).toEqual(['a', 'e'])
      expect(ids(filterRecipients(withOnline, { filterType: 'zero_credits', onlineOnlyIds: [] }))).toEqual(['a', 'e'])
    })
  })

  it('resumo: 5 primeiros nomes e "mais X"', () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ full_name: `A${i}` }))
    expect(summarizeRecipients(many)).toEqual({ names: ['A0', 'A1', 'A2', 'A3', 'A4'], more: 3 })
    expect(summarizeRecipients(many.slice(0, 2))).toEqual({ names: ['A0', 'A1'], more: 0 })
  })
})

describe('groupEmailHistory', () => {
  const row = (created_at, extra = {}) => ({
    created_at,
    subject: 'Aviso',
    email_type: 'custom',
    status: 'sent',
    recipient_email: 'x@x.com',
    ...extra
  })

  it('um envio com emails a segundos de distância vira uma linha só', () => {
    const groups = groupEmailHistory([
      row('2026-11-12T10:00:00.100Z'),
      row('2026-11-12T10:00:01.900Z'),
      row('2026-11-12T10:01:30.000Z', { status: 'failed' }),
      row('2026-11-12T10:03:00.000Z')
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({ recipients: 4, success: 3, failed: 1, timestamp: '2026-11-12T10:00:00.100Z' })
  })

  it('mais de 2 min de intervalo, outro assunto ou outro tipo → linhas separadas, mais recente primeiro', () => {
    const groups = groupEmailHistory([
      row('2026-11-12T10:00:00Z'),
      row('2026-11-12T10:02:01Z'),
      row('2026-11-12T10:02:02Z', { subject: 'Outro' }),
      row('2026-11-12T10:02:03Z', { email_type: 'low_credits' })
    ])
    expect(groups.map(g => [g.subject, g.type, g.recipients])).toEqual([
      ['Aviso', 'low_credits', 1],
      ['Outro', 'custom', 1],
      ['Aviso', 'custom', 1],
      ['Aviso', 'custom', 1]
    ])
  })

  it('envios intercalados do mesmo assunto continuam juntos', () => {
    const groups = groupEmailHistory([
      row('2026-11-12T10:00:00Z'),
      row('2026-11-12T10:00:01Z', { subject: 'Outro' }),
      row('2026-11-12T10:00:02Z')
    ])
    expect(groups).toHaveLength(2)
    expect(groups.find(g => g.subject === 'Aviso').recipients).toBe(2)
  })

  it('lista vazia', () => {
    expect(groupEmailHistory([])).toEqual([])
    expect(groupEmailHistory(null)).toEqual([])
  })
})
