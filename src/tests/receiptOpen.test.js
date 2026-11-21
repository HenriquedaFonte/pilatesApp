// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const rpc = vi.fn()
vi.mock('@/lib/supabase', () => ({
  supabase: { rpc, storage: { from: () => ({}) } },
}))

const { recordReceiptOpen } = await import('@/lib/receiptFiles')

const receipt = { id: 'r1', receipt_number: 'K-2026-0001', pdf_path: 's/r1.pdf', student_first_opened_at: null }

describe('recordReceiptOpen', () => {
  beforeEach(() => {
    rpc.mockReset()
    rpc.mockResolvedValue({ data: '2026-11-21T15:00:00+00:00', error: null })
  })

  it('chama a RPC do próprio aluno com o id do recibo e devolve a data', async () => {
    expect(await recordReceiptOpen(receipt, new Set())).toBe('2026-11-21T15:00:00+00:00')
    expect(rpc).toHaveBeenCalledWith('mark_receipt_opened_by_student', { p_receipt_id: 'r1' })
  })

  it('recibo já aberto: não chama a RPC', async () => {
    const opened = { ...receipt, student_first_opened_at: '2026-11-20T10:00:00+00:00' }
    expect(await recordReceiptOpen(opened, new Set())).toBeNull()
    expect(rpc).not.toHaveBeenCalled()
  })

  it('mesma página: o segundo toque não chama de novo', async () => {
    const seen = new Set()
    await recordReceiptOpen(receipt, seen)
    await recordReceiptOpen(receipt, seen)
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it('erro da RPC: não sobe, devolve null e o próximo toque tenta de novo', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: new Error('network') })
    const seen = new Set()
    expect(await recordReceiptOpen(receipt, seen)).toBeNull()
    expect(await recordReceiptOpen(receipt, seen)).toBe('2026-11-21T15:00:00+00:00')
    expect(rpc).toHaveBeenCalledTimes(2)
  })

  it('RPC rejeita (exceção): não sobe', async () => {
    rpc.mockRejectedValueOnce(new Error('boom'))
    await expect(recordReceiptOpen(receipt, new Set())).resolves.toBeNull()
  })

  it('sem recibo ou sem id: não chama', async () => {
    expect(await recordReceiptOpen(null)).toBeNull()
    expect(await recordReceiptOpen({})).toBeNull()
    expect(rpc).not.toHaveBeenCalled()
  })
})
