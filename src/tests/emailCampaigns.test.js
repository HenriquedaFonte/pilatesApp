import { describe, it, expect } from 'vitest'
import {
  HISTORY_PAGE_SIZE,
  campaignEmailType,
  buildCampaignRow,
  buildCampaignFilter,
  campaignSubject,
  campaignContent,
  failedStudentIds,
  buildResend,
  pageCount,
  pageRange
} from '../lib/emailCampaigns'

const content = {
  pt: { subject: ' Aviso ', message: 'Olá {nome}' },
  en: { subject: 'Notice', message: '' },
  fr: { subject: '', message: '' }
}

describe('campaignEmailType', () => {
  it('mesmo tipo gravado em email_notifications', () => {
    expect(campaignEmailType('custom')).toBe('custom')
    expect(campaignEmailType('low_credits')).toBe('low_credits')
    expect(campaignEmailType('consent')).toBe('consent_form')
  })
})

describe('buildCampaignRow', () => {
  it('custom: texto de cada língua (vazio → null), quem assina e total', () => {
    const row = buildCampaignRow({
      kind: 'custom',
      content,
      senderName: ' Josi ',
      filter: { group: 'all' },
      total: 3
    })
    expect(row).toEqual({
      email_type: 'custom',
      subject_pt: 'Aviso',
      subject_en: 'Notice',
      subject_fr: null,
      message_pt: 'Olá {nome}',
      message_en: null,
      message_fr: null,
      sender_name: 'Josi',
      recipient_filter: { group: 'all' },
      total: 3
    })
  })

  it('automático: só o assunto do histórico; nunca manda created_by, sent, failed ou status', () => {
    const row = buildCampaignRow({
      kind: 'consent',
      content,
      senderName: 'Josi',
      logSubject: 'Formulário',
      total: 1
    })
    expect(row).toMatchObject({ email_type: 'consent_form', subject_pt: 'Formulário', message_pt: null, sender_name: null })
    for (const key of ['created_by', 'sent', 'failed', 'status', 'id', 'created_at']) {
      expect(row).not.toHaveProperty(key)
    }
  })
})

describe('buildCampaignFilter', () => {
  it('guarda só o que define o grupo, sem dados de aluno', () => {
    expect(
      buildCampaignFilter({ filterType: 'low_credits', lowCreditsThreshold: 2, includeInactive: false, excludedCount: 1, templateId: 'lowCredits' })
    ).toEqual({ group: 'low_credits', threshold: 2, include_inactive: false, excluded: 1, template: 'lowCredits' })
    expect(
      buildCampaignFilter({ filterType: 'class', selectedClass: 'c1', className: 'Terça', includeInactive: true, excludedCount: 0 })
    ).toEqual({ group: 'class', class_id: 'c1', class_name: 'Terça', include_inactive: true })
    expect(
      buildCampaignFilter({ filterType: 'selected', excludedCount: 3, resendOf: 'camp-1' })
    ).toEqual({ group: 'selected', include_inactive: false, resend_of: 'camp-1' })
  })
})

describe('campaignSubject / campaignContent', () => {
  it('assunto da primeira língua preenchida', () => {
    expect(campaignSubject({ subject_pt: null, subject_en: 'Hi', subject_fr: 'Salut' })).toBe('Hi')
    expect(campaignSubject({})).toBe('')
  })

  it('texto no formato da tela', () => {
    expect(campaignContent({ subject_pt: 'A', message_pt: 'B', subject_fr: 'C' })).toEqual({
      pt: { subject: 'A', message: 'B' },
      en: { subject: '', message: '' },
      fr: { subject: 'C', message: '' }
    })
  })
})

describe('failedStudentIds / buildResend', () => {
  const rows = [
    { student_id: 'a', status: 'sent' },
    { student_id: 'b', status: 'failed' },
    { student_id: 'b', status: 'failed' },
    { student_id: 'c', status: 'failed' },
    { student_id: null, status: 'failed' },
    { student_id: 'd', status: 'failed' }
  ]
  const students = [
    { id: 'a', is_active: true },
    { id: 'b', is_active: true },
    { id: 'c', is_active: false }
  ]

  it('só quem falhou, sem repetir', () => {
    expect(failedStudentIds(rows)).toEqual(['b', 'c', 'd'])
  })

  it('reenvio: só quem falhou e ainda existe; liga inativos se precisar', () => {
    const resend = buildResend(
      { email_type: 'custom', subject_pt: 'Aviso', message_pt: 'Oi', sender_name: 'Josi' },
      rows,
      students
    )
    expect(resend).toMatchObject({
      templateId: 'blank',
      senderName: 'Josi',
      selectedIds: ['b', 'c'],
      missing: 1,
      includeInactive: true
    })
    expect(resend.content.pt).toEqual({ subject: 'Aviso', message: 'Oi' })
  })

  it('reenvio de aviso automático usa o mesmo modelo', () => {
    expect(buildResend({ email_type: 'low_credits' }, rows, students).templateId).toBe('lowCredits')
    expect(buildResend({ email_type: 'consent_form' }, rows, students).templateId).toBe('consentForm')
    expect(buildResend({ email_type: 'consent_form' }, [rows[1]], students).includeInactive).toBe(false)
  })
})

describe('paginação', () => {
  it('20 por página', () => {
    expect(HISTORY_PAGE_SIZE).toBe(20)
    expect(pageCount(0)).toBe(1)
    expect(pageCount(20)).toBe(1)
    expect(pageCount(21)).toBe(2)
    expect(pageRange(1)).toEqual([0, 19])
    expect(pageRange(3)).toEqual([40, 59])
  })
})

describe('Story 4.5: progresso do envio pelo servidor', () => {
  it('campaignProgress: processados = enviados + falhas, nunca acima do total', async () => {
    const { campaignProgress } = await import('../lib/emailCampaigns')
    expect(campaignProgress({ total: 10, sent: 3, failed: 1, status: 'sending' })).toEqual({
      done: 4,
      total: 10,
      finished: false
    })
    expect(campaignProgress({ total: 2, sent: 2, failed: 1, status: 'done' })).toEqual({
      done: 2,
      total: 2,
      finished: true
    })
    expect(campaignProgress(null)).toEqual({ done: 0, total: 0, finished: false })
  })

  it('shouldKick: chama de novo só depois de um tempo sem mudança e sem chamada recente', async () => {
    const { shouldKick, KICK_AFTER_MS } = await import('../lib/emailCampaigns')
    expect(shouldKick({ lastChangeAt: 0, lastKickAt: 0, now: KICK_AFTER_MS })).toBe(true)
    expect(shouldKick({ lastChangeAt: 1000, lastKickAt: 0, now: KICK_AFTER_MS })).toBe(false)
    expect(shouldKick({ lastChangeAt: 0, lastKickAt: 5000, now: KICK_AFTER_MS })).toBe(false)
  })

  it('isServerSending e campaignResult', async () => {
    const { isServerSending, campaignResult } = await import('../lib/emailCampaigns')
    expect(isServerSending({ send_mode: 'server', status: 'sending' })).toBe(true)
    expect(isServerSending({ send_mode: 'browser', status: 'sending' })).toBe(false)
    expect(isServerSending({ send_mode: 'server', status: 'done' })).toBe(false)
    const names = new Map([['s1', 'Ana']])
    expect(
      campaignResult({ sent: 4 }, [
        { student_id: 's1', status: 'failed', error_message: 'resend_422:validation_error' },
        { student_id: 's2', recipient_email: 'b@x.com', status: 'failed', error_message: null },
        { student_id: 's3', status: 'sent' }
      ], names)
    ).toEqual({
      success: 4,
      failed: [
        { name: 'Ana', error: 'resend_422:validation_error' },
        { name: 'b@x.com', error: '' }
      ]
    })
  })
})
