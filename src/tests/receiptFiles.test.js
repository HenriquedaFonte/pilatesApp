// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const download = vi.fn()
vi.mock('@/lib/supabase', () => ({
  supabase: { storage: { from: () => ({ download }) } },
}))

const { shareReceipt } = await import('@/lib/receiptFiles')

const receipt = { id: 'r1', receipt_number: 'K-2026-0001', pdf_path: 's/r1.pdf' }

const setNavigator = nav => vi.stubGlobal('navigator', nav)

describe('shareReceipt', () => {
  beforeEach(() => {
    download.mockReset()
    download.mockResolvedValue({ data: new Blob(['%PDF']), error: null })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('compartilha o PDF com o nome = número do recibo', async () => {
    const share = vi.fn().mockResolvedValue()
    setNavigator({ canShare: () => true, share })
    expect(await shareReceipt(receipt, {})).toBe('shared')
    const { files } = share.mock.calls[0][0]
    expect(files[0].name).toBe('K-2026-0001.pdf')
    expect(files[0].type).toBe('application/pdf')
  })

  it('aparelho sem Web Share de arquivo: unsupported', async () => {
    setNavigator({ canShare: () => false, share: vi.fn() })
    expect(await shareReceipt(receipt, {})).toBe('unsupported')
  })

  it('Safari recusa por demora: retry, e o próximo toque não baixa de novo', async () => {
    const cache = {}
    const share = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('x'), { name: 'NotAllowedError' }))
      .mockResolvedValueOnce()
    setNavigator({ canShare: () => true, share })
    expect(await shareReceipt(receipt, cache)).toBe('retry')
    expect(await shareReceipt(receipt, cache)).toBe('shared')
    expect(download).toHaveBeenCalledTimes(1)
  })

  it('usuário cancela: cancelled; outro erro sobe', async () => {
    setNavigator({ canShare: () => true, share: vi.fn().mockRejectedValue(Object.assign(new Error('x'), { name: 'AbortError' })) })
    expect(await shareReceipt(receipt, {})).toBe('cancelled')
    setNavigator({ canShare: () => true, share: vi.fn().mockRejectedValue(new Error('boom')) })
    await expect(shareReceipt(receipt, {})).rejects.toThrow('boom')
  })

  it('falha ao baixar o PDF sobe', async () => {
    download.mockResolvedValue({ data: null, error: new Error('403') })
    setNavigator({ canShare: () => true, share: vi.fn() })
    await expect(shareReceipt(receipt, {})).rejects.toThrow('403')
  })
})
