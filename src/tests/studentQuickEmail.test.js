import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  ZERO_CREDITS_TEMPLATE,
  canSendZeroCreditsEmail,
  buildQuickCampaignRow,
  sendTemplateToStudent
} from '../lib/studentQuickEmail'
import { templateContent } from '../lib/templateCards'

// Cliente supabase falso: grava o que foi inserido e as RPCs chamadas, e
// devolve a campanha na ordem de `campaignReads` (a última se repete).
const fakeDb = ({
  insertError = null,
  queueError = null,
  campaignReads = [{ id: 'camp-1', total: 1, sent: 1, failed: 0, status: 'done' }]
} = {}) => {
  const calls = { inserted: [], rpc: [], reads: 0 }
  const db = {
    calls,
    from(table) {
      expect(table).toBe('email_campaigns')
      return {
        insert(row) {
          calls.inserted.push(row)
          return {
            select: () => ({
              single: async () =>
                insertError ? { data: null, error: insertError } : { data: { id: 'camp-1' }, error: null }
            })
          }
        },
        select(cols) {
          expect(cols).toBe('id, total, sent, failed, status')
          return {
            eq: (col, value) => {
              expect(col).toBe('id')
              expect(value).toBe('camp-1')
              return {
                single: async () => {
                  const i = Math.min(calls.reads, campaignReads.length - 1)
                  calls.reads += 1
                  return { data: campaignReads[i], error: null }
                }
              }
            }
          }
        }
      }
    },
    async rpc(name, args) {
      calls.rpc.push({ name, args })
      if (name === 'queue_email_campaign') {
        return queueError ? { data: null, error: queueError } : { data: 1, error: null }
      }
      return { data: null, error: null }
    }
  }
  return db
}

const student = { id: 'stu-1', full_name: 'Aluna Teste', email: 'aluna@example.com', is_active: true }
const sleep = vi.fn(async () => {})

const run = (db, startCampaign, extra = {}) =>
  sendTemplateToStudent({
    db,
    startCampaign,
    student,
    templateId: ZERO_CREDITS_TEMPLATE,
    senderName: 'Josi',
    sleep,
    ...extra
  })

beforeEach(() => {
  sleep.mockClear()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('canSendZeroCreditsEmail', () => {
  it('só com saldo 0 ou negativo e fora do "só online"', () => {
    expect(canSendZeroCreditsEmail({ totalBalance: 0, onlineOnly: false })).toBe(true)
    expect(canSendZeroCreditsEmail({ totalBalance: -1, onlineOnly: false })).toBe(true)
    expect(canSendZeroCreditsEmail({ totalBalance: 3, onlineOnly: false })).toBe(false)
    expect(canSendZeroCreditsEmail({ totalBalance: 0, onlineOnly: true })).toBe(false)
  })
})

describe('buildQuickCampaignRow', () => {
  it('registra o modelo para um aluno, com a origem "student_card"', () => {
    const row = buildQuickCampaignRow({ templateId: ZERO_CREDITS_TEMPLATE, senderName: 'Josi', includeInactive: true })
    expect(row.recipient_filter).toEqual({
      group: 'selected',
      include_inactive: true,
      template: 'zeroCreditsNotice',
      source: 'student_card'
    })
    expect(row.total).toBe(1)
  })
})

describe('sendTemplateToStudent', () => {
  it('caminho feliz: grava a campanha com o texto do modelo, põe o aluno na fila, dispara e devolve "sent"', async () => {
    const db = fakeDb()
    const startCampaign = vi.fn(async () => 'started')
    const result = await run(db, startCampaign)

    expect(result).toEqual({ status: 'sent', campaignId: 'camp-1' })

    expect(db.calls.inserted).toHaveLength(1)
    const row = db.calls.inserted[0]
    const content = templateContent('zeroCreditsNotice')
    expect(row.email_type).toBe('custom')
    for (const lang of ['pt', 'en', 'fr']) {
      expect(row[`subject_${lang}`]).toBe(content[lang].subject.trim())
      expect(row[`message_${lang}`]).toBe(content[lang].message.trim())
      expect(row[`subject_${lang}`]).toBeTruthy()
      expect(row[`message_${lang}`]).toBeTruthy()
    }
    expect(row.recipient_filter).toMatchObject({
      group: 'selected',
      template: 'zeroCreditsNotice',
      source: 'student_card',
      include_inactive: false
    })
    expect(row.total).toBe(1)
    expect(row.sender_name).toBe('Josi')
    expect(row).not.toHaveProperty('created_by')
    // Nenhum dado pessoal do aluno no registro.
    expect(JSON.stringify(row)).not.toContain('aluna@example.com')
    expect(JSON.stringify(row)).not.toContain('Aluna Teste')

    expect(db.calls.rpc).toEqual([
      { name: 'queue_email_campaign', args: { p_campaign_id: 'camp-1', p_student_ids: ['stu-1'] } }
    ])
    expect(startCampaign).toHaveBeenCalledTimes(1)
    expect(startCampaign).toHaveBeenCalledWith('camp-1')
  })

  it('aluno inativo: include_inactive no registro', async () => {
    const db = fakeDb()
    await sendTemplateToStudent({
      db,
      startCampaign: vi.fn(async () => {}),
      student: { ...student, is_active: false },
      templateId: ZERO_CREDITS_TEMPLATE,
      senderName: 'Josi',
      sleep
    })
    expect(db.calls.inserted[0].recipient_filter.include_inactive).toBe(true)
  })

  it('campanha terminada com falha e nenhum enviado → "failed"', async () => {
    const db = fakeDb({ campaignReads: [{ id: 'camp-1', total: 1, sent: 0, failed: 1, status: 'failed' }] })
    const result = await run(db, vi.fn(async () => {}))
    expect(result).toEqual({ status: 'failed', campaignId: 'camp-1' })
  })

  it('erro ao registrar: nada vai para a fila nem é disparado', async () => {
    const db = fakeDb({ insertError: { code: '42501', message: 'denied' } })
    const startCampaign = vi.fn()
    const result = await run(db, startCampaign)
    expect(result).toEqual({ status: 'error', step: 'campaign' })
    expect(db.calls.rpc).toEqual([])
    expect(startCampaign).not.toHaveBeenCalled()
  })

  it('erro na fila: fecha o registro com finish_email_campaign e não dispara', async () => {
    const db = fakeDb({ queueError: { code: '55000', message: 'campaign already started' } })
    const startCampaign = vi.fn()
    const result = await run(db, startCampaign)
    expect(result).toEqual({ status: 'error', step: 'queue' })
    expect(db.calls.rpc.map(c => c.name)).toEqual(['queue_email_campaign', 'finish_email_campaign'])
    expect(db.calls.rpc[1].args).toEqual({ p_campaign_id: 'camp-1' })
    expect(startCampaign).not.toHaveBeenCalled()
  })

  it('startCampaign falha uma vez e depois funciona → duas chamadas, resultado normal', async () => {
    const db = fakeDb()
    const startCampaign = vi
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce('started')
    const result = await run(db, startCampaign)
    expect(startCampaign).toHaveBeenCalledTimes(2)
    expect(result).toEqual({ status: 'sent', campaignId: 'camp-1' })
  })

  it('startCampaign falha duas vezes → segue acompanhando (não tenta uma terceira)', async () => {
    const db = fakeDb()
    const startCampaign = vi.fn().mockRejectedValue(new Error('network'))
    const result = await run(db, startCampaign)
    expect(startCampaign).toHaveBeenCalledTimes(2)
    expect(result).toEqual({ status: 'sent', campaignId: 'camp-1' })
  })

  it('tempo esgotado com a campanha ainda "sending" → "pending"', async () => {
    const db = fakeDb({ campaignReads: [{ id: 'camp-1', total: 1, sent: 0, failed: 0, status: 'sending' }] })
    const result = await run(db, vi.fn(async () => {}), { waitMs: 20000, pollMs: 2000 })
    expect(result).toEqual({ status: 'pending', campaignId: 'camp-1' })
    expect(db.calls.reads).toBe(10)
  })

  it('espera o fim: "sending" e depois "done" → "sent"', async () => {
    const db = fakeDb({
      campaignReads: [
        { id: 'camp-1', total: 1, sent: 0, failed: 0, status: 'sending' },
        { id: 'camp-1', total: 1, sent: 1, failed: 0, status: 'done' }
      ]
    })
    const result = await run(db, vi.fn(async () => {}))
    expect(result).toEqual({ status: 'sent', campaignId: 'camp-1' })
    expect(db.calls.reads).toBe(2)
  })

  it('não registra em log o email nem o nome do aluno', async () => {
    const db = fakeDb({ queueError: { code: '22023', message: 'aluna@example.com' } })
    await run(db, vi.fn())
    const logged = JSON.stringify(console.error.mock.calls)
    expect(logged).not.toContain('aluna@example.com')
    expect(logged).not.toContain('Aluna Teste')
    expect(logged).toContain('22023')
  })
})
