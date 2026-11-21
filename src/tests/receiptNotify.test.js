// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import pt from '@/locales/pt.json'
import en from '@/locales/en.json'
import fr from '@/locales/fr.json'

const invoke = vi.fn()
vi.mock('@/lib/supabase', () => ({
  supabase: { functions: { invoke: (...args) => invoke(...args) }, rpc: vi.fn(), storage: { from: () => ({}) } },
}))
vi.mock('@/lib/receiptPdf', () => ({ generateReceiptPdf: vi.fn() }))

const { notifyStudentAboutReceipt, notifyStudentInBackground, NOTIFY_TOASTS } = await import('@/lib/receiptService')

const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj)

describe('notifyStudentAboutReceipt', () => {
  beforeEach(() => { invoke.mockReset() })

  it('manda só o type, o id e o evento para a send-email', async () => {
    invoke.mockResolvedValue({ data: { success: true, data: { id: 'x' } }, error: null })
    expect(await notifyStudentAboutReceipt('r1', 'issued')).toBe('sent')
    expect(invoke).toHaveBeenCalledWith('send-email', {
      body: { type: 'receipt_notice', receipt_id: 'r1', event: 'issued' },
    })
  })

  it('aluno sem email: "no_email"', async () => {
    invoke.mockResolvedValue({ data: { success: false, skipped: 'no_email' }, error: null })
    expect(await notifyStudentAboutReceipt('r1', 'voided')).toBe('no_email')
  })

  it('erro da função ou resposta sem sucesso: exceção', async () => {
    invoke.mockResolvedValueOnce({ data: null, error: new Error('403') })
    await expect(notifyStudentAboutReceipt('r1', 'issued')).rejects.toThrow()
    invoke.mockResolvedValueOnce({ data: { success: false }, error: null })
    await expect(notifyStudentAboutReceipt('r1', 'issued')).rejects.toThrow()
  })
})

describe('notifyStudentInBackground', () => {
  beforeEach(() => { invoke.mockReset() })

  it('nunca rejeita: erro vira "failed"', async () => {
    invoke.mockRejectedValue(new Error('rede'))
    const onResult = vi.fn()
    const res = notifyStudentInBackground('r1', 'issued', onResult)
    await expect(res).resolves.toBe('failed')
    expect(onResult).toHaveBeenCalledWith('failed')
  })

  it('passa "sent" e "no_email" para a tela', async () => {
    const onResult = vi.fn()
    invoke.mockResolvedValueOnce({ data: { success: true }, error: null })
    await notifyStudentInBackground('r1', 'issued', onResult)
    invoke.mockResolvedValueOnce({ data: { success: false, skipped: 'no_email' }, error: null })
    await notifyStudentInBackground('r1', 'voided', onResult)
    expect(onResult.mock.calls).toEqual([['sent'], ['no_email']])
  })

  it('erro no aviso da tela não sobe', async () => {
    invoke.mockResolvedValue({ data: { success: true }, error: null })
    await expect(notifyStudentInBackground('r1', 'issued', () => { throw new Error('toast') })).resolves.toBe('sent')
  })
})

describe('textos do aviso', () => {
  it('os 3 toasts existem em pt, en e fr', () => {
    for (const { key } of Object.values(NOTIFY_TOASTS)) {
      for (const locale of [pt, en, fr]) expect(typeof get(locale, key)).toBe('string')
    }
  })

  it('as confirmações de emitir e anular falam do email nas 3 línguas', () => {
    expect(pt.receipts.dialog.confirmText).toMatch(/e-mail/)
    expect(en.receipts.dialog.confirmText).toMatch(/email/)
    expect(fr.receipts.dialog.confirmText).toMatch(/courriel/)
    expect(pt.receipts.void.description).toMatch(/e-mail/)
    expect(en.receipts.void.description).toMatch(/email/)
    expect(fr.receipts.void.description).toMatch(/courriel/)
  })
})
