// @vitest-environment node
import { describe, it, expect } from 'vitest'
import process from 'node:process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  authorizeReceiptNotice,
  buildReceiptNotice,
  buildReceiptNoticeContent,
  isReceiptNoticeBody,
  readReceiptNoticeRequest,
  receiptNoticeIdempotencyKey,
  NOTICE_WINDOW_MS,
  RECEIPTS_URL
} from '../../supabase/functions/send-email/receiptNotice.ts'
import { STUDIO_FROM } from '../../supabase/functions/send-email/policy.ts'

// Aviso ao aluno quando um recibo é emitido ou anulado (send-email, type 'receipt_notice').

const NOW = Date.parse('2026-11-21T15:00:00Z')
const ID = '0b7c6a4e-1f2d-4c3b-9a8e-7d6c5b4a3f21'
const minutesAgo = m => new Date(NOW - m * 60 * 1000).toISOString()

const issuedReceipt = {
  id: ID,
  receipt_number: 'K-2026-0007',
  student_id: 's1',
  status: 'issued',
  issued_at: minutesAgo(1),
  voided_at: null,
  // Campos que NUNCA podem ir para o email (o index.ts nem lê; aqui para provar):
  total_fees: 123.45,
  void_reason: 'MOTIVO-SECRETO',
  treatments: [{ date: '2026-11-20', amount: 123.45 }]
}
const voidedReceipt = { ...issuedReceipt, status: 'void', voided_at: minutesAgo(1), void_reason: 'MOTIVO-SECRETO' }
const student = { email: 'aluna@example.com', full_name: 'Maria Exemplo', preferred_language: 'pt', deleted_at: null }

const issued = { receiptId: ID, event: 'issued' }
const voided = { receiptId: ID, event: 'voided' }

describe('receipt_notice: pedido e permissão', () => {
  it('reconhece o type', () => {
    expect(isReceiptNoticeBody({ type: 'receipt_notice' })).toBe(true)
    expect(isReceiptNoticeBody({ type: 'contact' })).toBe(false)
    expect(isReceiptNoticeBody(null)).toBe(false)
    expect(isReceiptNoticeBody([])).toBe(false)
  })

  it('lê só receipt_id (uuid) e event; o resto do corpo é ignorado', () => {
    expect(readReceiptNoticeRequest({
      type: 'receipt_notice', receipt_id: ID.toUpperCase(), event: 'issued',
      to: ['outro@example.com'], subject: 'x', html: '<b>x</b>'
    })).toEqual({ receiptId: ID, event: 'issued' })
    expect(readReceiptNoticeRequest({ receipt_id: ID, event: 'voided' })).toEqual({ receiptId: ID, event: 'voided' })
    expect(readReceiptNoticeRequest({ receipt_id: 'abc', event: 'issued' })).toBeNull()
    expect(readReceiptNoticeRequest({ receipt_id: ID, event: 'paid' })).toBeNull()
    expect(readReceiptNoticeRequest({ receipt_id: ID })).toBeNull()
  })

  it('só professora/admin', () => {
    expect(authorizeReceiptNotice({ kind: 'staff', userId: 't1' })).toBeNull()
    expect(authorizeReceiptNotice({ kind: 'anonymous' })).toEqual({ kind: 'fail', status: 401, error: 'Unauthorized' })
    expect(authorizeReceiptNotice({ kind: 'service' })).toEqual({ kind: 'fail', status: 403, error: 'Forbidden' })
    expect(authorizeReceiptNotice({ kind: 'user', userId: 's1', email: 'a@b.com', createdAt: null }))
      .toEqual({ kind: 'fail', status: 403, error: 'Forbidden' })
  })
})

describe('receipt_notice: recibo emitido', () => {
  it('vai para o email do perfil, do remetente fixo, sem anexo nem Reply-To, com chave de idempotência', () => {
    const r = buildReceiptNotice({ request: issued, receipt: issuedReceipt, student, now: NOW })
    expect(r.kind).toBe('send')
    expect(r.email.from).toBe(STUDIO_FROM)
    expect(r.email.to).toEqual(['aluna@example.com'])
    expect(r.email.attachments).toEqual([])
    expect(r.email.reply_to).toBeUndefined()
    expect(r.idempotencyKey).toBe(receiptNoticeIdempotencyKey(ID, 'issued'))
    expect(r.idempotencyKey).toBe(`receipt-notice/${ID}/issued`)
  })

  it('leva nome, número e o link de "Meus recibos"; nada de valores, datas, tipo ou motivo', () => {
    const r = buildReceiptNotice({ request: issued, receipt: issuedReceipt, student, now: NOW })
    for (const body of [r.email.html, r.email.text]) {
      expect(body).toContain('Maria Exemplo')
      expect(body).toContain('K-2026-0007')
      expect(body).toContain(RECEIPTS_URL)
      expect(body).not.toContain('123')
      expect(body).not.toContain('2026-11-20')
      expect(body).not.toContain('MOTIVO-SECRETO')
      expect(body).not.toMatch(/kin[ée]sith|naturopath/i)
    }
    expect(r.email.subject).not.toContain('K-2026-0007')
  })

  it('emitido há mais de 15 minutos ou anulado: recusado (409)', () => {
    const old = { ...issuedReceipt, issued_at: new Date(NOW - NOTICE_WINDOW_MS - 1000).toISOString() }
    expect(buildReceiptNotice({ request: issued, receipt: old, student, now: NOW }))
      .toEqual({ kind: 'fail', status: 409, error: 'Notice not allowed' })
    expect(buildReceiptNotice({ request: issued, receipt: voidedReceipt, student, now: NOW }).kind).toBe('fail')
    const future = { ...issuedReceipt, issued_at: new Date(NOW + 5 * 60 * 1000).toISOString() }
    expect(buildReceiptNotice({ request: issued, receipt: future, student, now: NOW }).kind).toBe('fail')
    const fresh = { ...issuedReceipt, issued_at: minutesAgo(14) }
    expect(buildReceiptNotice({ request: issued, receipt: fresh, student, now: NOW }).kind).toBe('send')
  })
})

describe('receipt_notice: recibo anulado', () => {
  it('avisa sem o motivo; exige recibo anulado há pouco', () => {
    const r = buildReceiptNotice({ request: voided, receipt: voidedReceipt, student, now: NOW })
    expect(r.kind).toBe('send')
    expect(r.email.subject).toBe('Um recibo de seguro foi anulado')
    expect(r.email.html).not.toContain('MOTIVO-SECRETO')
    expect(r.email.text).not.toContain('MOTIVO-SECRETO')
    expect(r.idempotencyKey).toBe(`receipt-notice/${ID}/voided`)
    expect(buildReceiptNotice({ request: voided, receipt: issuedReceipt, student, now: NOW }).kind).toBe('fail')
    const old = { ...voidedReceipt, voided_at: minutesAgo(16) }
    expect(buildReceiptNotice({ request: voided, receipt: old, student, now: NOW }).kind).toBe('fail')
  })
})

describe('receipt_notice: aluno e recibo', () => {
  it('sem email, email inválido, perfil na lixeira ou sem perfil: nada sai', () => {
    for (const s of [
      { ...student, email: null },
      { ...student, email: 'sem-arroba' },
      { ...student, deleted_at: '2026-11-01T00:00:00Z' },
      null
    ]) {
      expect(buildReceiptNotice({ request: issued, receipt: issuedReceipt, student: s, now: NOW }))
        .toEqual({ kind: 'skip', reason: 'no_email' })
    }
  })

  it('recibo inexistente ou de outro id: 404', () => {
    expect(buildReceiptNotice({ request: issued, receipt: null, student, now: NOW }))
      .toEqual({ kind: 'fail', status: 404, error: 'Receipt not found' })
    expect(buildReceiptNotice({ request: issued, receipt: { ...issuedReceipt, id: 'outro' }, student, now: NOW }).kind)
      .toBe('fail')
  })
})

describe('receipt_notice: texto', () => {
  it('três línguas pela preferência do aluno; outra ou vazia → pt', () => {
    expect(buildReceiptNoticeContent('issued', 'K-2026-0007', 'Ana', 'pt').subject).toBe('Seu recibo de seguro está disponível')
    expect(buildReceiptNoticeContent('issued', 'K-2026-0007', 'Ana', 'en').subject).toBe('Your insurance receipt is available')
    expect(buildReceiptNoticeContent('issued', 'K-2026-0007', 'Ana', 'fr').subject).toBe("Votre reçu d'assurance est disponible")
    expect(buildReceiptNoticeContent('voided', 'K-2026-0007', 'Ana', 'en').subject).toBe('An insurance receipt was voided')
    expect(buildReceiptNoticeContent('voided', 'K-2026-0007', 'Ana', 'fr').subject).toBe("Un reçu d'assurance a été annulé")
    expect(buildReceiptNoticeContent('issued', 'K-2026-0007', 'Ana', 'es').subject).toBe('Seu recibo de seguro está disponível')
    expect(buildReceiptNoticeContent('issued', 'K-2026-0007', 'Ana', null).subject).toBe('Seu recibo de seguro está disponível')
  })

  it('nome escapado e em uma linha; sem nome, saudação sem nome', () => {
    const c = buildReceiptNoticeContent('issued', 'K-2026-0007', 'Ana <b>X</b>\nY', 'pt')
    expect(c.html).toContain('Olá, Ana &lt;b&gt;X&lt;/b&gt; Y!')
    expect(c.html).not.toContain('<b>X</b>')
    expect(c.text).toContain('Olá, Ana <b>X</b> Y!')
    expect(buildReceiptNoticeContent('issued', 'K-2026-0007', '', 'pt').text.startsWith('Olá!')).toBe(true)
  })

  it('emitido diz que o PDF não vai anexado; anulado não fala de anexo', () => {
    expect(buildReceiptNoticeContent('issued', 'K-2026-0007', 'Ana', 'pt').text).toContain('não vai anexado')
    expect(buildReceiptNoticeContent('voided', 'K-2026-0007', 'Ana', 'pt').text).not.toContain('anexado')
  })
})

// Prévia para o dono: só roda com RECEIPT_NOTICE_PREVIEW_DIR=<pasta> (grava 6 .html e 6 .txt).
const previewDir = process.env.RECEIPT_NOTICE_PREVIEW_DIR
describe.runIf(Boolean(previewDir))('prévia dos emails', () => {
  it('grava os 6 emails', () => {
    mkdirSync(previewDir, { recursive: true })
    for (const event of ['issued', 'voided']) {
      for (const lang of ['pt', 'en', 'fr']) {
        const c = buildReceiptNoticeContent(event, 'K-2026-0007', 'Maria Exemplo', lang)
        writeFileSync(join(previewDir, `${event}-${lang}.html`), c.html)
        writeFileSync(join(previewDir, `${event}-${lang}.txt`), `Assunto: ${c.subject}\n\n${c.text}\n`)
      }
    }
  })
})
