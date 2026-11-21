// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { yearPeriod } from '@/lib/receiptReport'

let pages = []
const builder = {
  select: vi.fn(() => builder),
  gte: vi.fn(() => builder),
  lt: vi.fn(() => builder),
  order: vi.fn(() => builder),
  range: vi.fn(() => Promise.resolve(pages.shift())),
}
const from = vi.fn(() => builder)
vi.mock('@/lib/supabase', () => ({ supabase: { from } }))

const { fetchReceiptsForReport, REPORT_COLUMNS, REPORT_PAGE_SIZE } = await import('@/lib/receiptReportService')

const makeRows = n => Array.from({ length: n }, (_, i) => ({ id: `r${i}` }))

describe('receiptReportService — fetchReceiptsForReport', () => {
  beforeEach(() => {
    pages = []
    from.mockClear()
    for (const fn of Object.values(builder)) fn.mockClear()
  })

  it('1. lê insurance_receipts só com as colunas necessárias', async () => {
    pages = [{ data: [], error: null }]
    await fetchReceiptsForReport(yearPeriod(2026))
    expect(from).toHaveBeenCalledWith('insurance_receipts')
    expect(builder.select).toHaveBeenCalledWith(REPORT_COLUMNS)
    expect(REPORT_COLUMNS).toContain('patient_name:snapshot->patient->>fullName')
    expect(REPORT_COLUMNS).not.toContain('snapshot,')
    expect(REPORT_COLUMNS).not.toContain('void_reason')
    expect(REPORT_COLUMNS).not.toContain('dateOfBirth')
  })

  it('2. janela UTC e ordem estável', async () => {
    pages = [{ data: [], error: null }]
    await fetchReceiptsForReport(yearPeriod(2026))
    expect(builder.gte).toHaveBeenCalledWith('issued_at', '2026-01-01T00:00:00.000Z')
    expect(builder.lt).toHaveBeenCalledWith('issued_at', '2027-01-02T00:00:00.000Z')
    expect(builder.order).toHaveBeenNthCalledWith(1, 'issued_at', { ascending: true })
    expect(builder.order).toHaveBeenNthCalledWith(2, 'receipt_number', { ascending: true })
  })

  it('3. paginação de 1000 em 1000', async () => {
    pages = [
      { data: makeRows(REPORT_PAGE_SIZE), error: null },
      { data: makeRows(3), error: null },
    ]
    const rows = await fetchReceiptsForReport(yearPeriod(2026))
    expect(rows).toHaveLength(1003)
    expect(builder.range).toHaveBeenCalledTimes(2)
    expect(builder.range).toHaveBeenNthCalledWith(1, 0, 999)
    expect(builder.range).toHaveBeenNthCalledWith(2, 1000, 1999)
  })

  it('4. página única vazia (data null) → []', async () => {
    pages = [{ data: null, error: null }]
    expect(await fetchReceiptsForReport(yearPeriod(2026))).toEqual([])
    expect(builder.range).toHaveBeenCalledTimes(1)
  })

  it('5. erro do Supabase: rejeita', async () => {
    pages = [{ data: null, error: new Error('permission denied') }]
    await expect(fetchReceiptsForReport(yearPeriod(2026))).rejects.toThrow('permission denied')
  })
})
