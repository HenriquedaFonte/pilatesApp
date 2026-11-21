// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import writeXlsxFile from 'write-excel-file/universal'
import {
  availableYears,
  buildReportSheets,
  isValidPeriod,
  montrealDateTimeLabel,
  reportFileName,
  summarizeReport,
  utcQueryWindow,
  yearPeriod,
} from '@/lib/receiptReport'

const t = (k, o) => (o ? `${k}|${JSON.stringify(o)}` : k)

const period2026 = yearPeriod(2026)

const row = (overrides = {}) => ({
  id: overrides.receipt_number || 'r',
  receipt_number: 'K-2026-0001',
  receipt_type: 'kinesitherapy',
  student_id: 's1',
  issued_at: '2026-03-10T15:00:00Z',
  total_fees: '0.00',
  total_products: '0.00',
  status: 'issued',
  voided_at: null,
  patient_name: 'Aluno Um',
  ...overrides,
})

// Linhas do teste 6/10: dois emitidos (K e N) e um anulado (K).
const sampleRows = () => [
  row({
    receipt_number: 'K-2026-0001',
    receipt_type: 'kinesitherapy',
    issued_at: '2026-01-01T05:30:00Z',
    total_fees: '85.10',
    total_products: '0.00',
    patient_name: 'Aluno Um',
  }),
  row({
    receipt_number: 'N-2026-0001',
    receipt_type: 'naturopathy',
    issued_at: '2026-02-01T15:00:00Z',
    total_fees: 0.2,
    total_products: '19.99',
    patient_name: 'Aluno Dois',
  }),
  row({
    receipt_number: 'K-2026-0002',
    receipt_type: 'kinesitherapy',
    issued_at: '2026-03-01T15:00:00Z',
    total_fees: '1000.00',
    total_products: '0.00',
    status: 'void',
    voided_at: '2026-03-02T15:00:00Z',
    patient_name: 'Aluno Tres',
  }),
]

const sheetsFor = (rows, extra = {}) =>
  buildReportSheets(summarizeReport(rows, period2026), {
    t,
    period: period2026,
    generatedAt: '2026-11-21 10:00',
    ...extra,
  })

const cellValues = data => data.flat().map(c => (c && typeof c === 'object' && 'value' in c ? c.value : c))

describe('receiptReport — regras puras', () => {
  it('1. yearPeriod', () => {
    expect(yearPeriod(2026)).toEqual({ from: '2026-01-01', to: '2026-12-31' })
  })

  it('2. availableYears pelo ano de Montréal, a partir de 2026', () => {
    expect(availableYears(new Date('2028-03-01T12:00:00Z'))).toEqual([2028, 2027, 2026])
    expect(availableYears(new Date('2026-05-01T12:00:00Z'))).toEqual([2026])
    expect(availableYears(new Date('2027-01-01T03:00:00Z'))).toEqual([2026])
    expect(availableYears(new Date('2025-06-01T12:00:00Z'))).toEqual([2026])
  })

  it('3. isValidPeriod', () => {
    expect(isValidPeriod({ from: '2026-01-01', to: '2026-01-01' })).toBe(true)
    expect(isValidPeriod({ from: '2026-02-01', to: '2026-01-31' })).toBe(false)
    expect(isValidPeriod({ from: '', to: '' })).toBe(false)
    expect(isValidPeriod()).toBe(false)
    expect(isValidPeriod({ from: '2026-02-30', to: '2026-03-01' })).toBe(false)
    expect(isValidPeriod({ from: '2026-01-01', to: '2026-02-30' })).toBe(false)
  })

  it('4. utcQueryWindow', () => {
    expect(utcQueryWindow({ from: '2026-01-01', to: '2026-12-31' })).toEqual({
      gte: '2026-01-01T00:00:00.000Z',
      lt: '2027-01-02T00:00:00.000Z',
    })
  })

  it('5. corte pelo dia de Montréal', () => {
    const rows = [
      row({ receipt_number: 'K-A', issued_at: '2026-01-01T04:30:00Z' }),
      row({ receipt_number: 'K-B', issued_at: '2026-01-01T05:30:00Z' }),
      row({ receipt_number: 'K-C', issued_at: '2027-01-01T03:30:00Z' }),
      row({ receipt_number: 'K-D', issued_at: '2027-01-01T05:30:00Z' }),
    ]
    const { issued } = summarizeReport(rows, period2026)
    expect(issued.map(r => r.receipt_number)).toEqual(['K-B', 'K-C'])
  })

  it('6. totais em centavos exatos e anulado fora', () => {
    const { totals, byType, voided, issued } = summarizeReport(sampleRows(), period2026)
    expect(totals).toEqual({ count: 2, feesCents: 8530, productsCents: 1999, totalCents: 10529 })
    expect(byType.kinesitherapy.count).toBe(1)
    expect(byType.naturopathy.productsCents).toBe(1999)
    expect(voided.length).toBe(1)
    expect(issued.length).toBe(2)
  })

  it('7. ordem por issued_at e, no empate, por número', () => {
    const same = '2026-05-05T15:00:00Z'
    const tie = summarizeReport(
      [
        row({ receipt_number: 'K-2026-0003', issued_at: same }),
        row({ receipt_number: 'K-2026-0002', issued_at: same }),
      ],
      period2026,
    )
    expect(tie.issued.map(r => r.receipt_number)).toEqual(['K-2026-0002', 'K-2026-0003'])

    const unordered = summarizeReport(
      [
        row({ receipt_number: 'X3', issued_at: '2026-09-01T15:00:00Z' }),
        row({ receipt_number: 'X1', issued_at: '2026-02-01T15:00:00Z' }),
        row({ receipt_number: 'X2', issued_at: '2026-05-01T15:00:00Z' }),
      ],
      period2026,
    )
    expect(unordered.issued.map(r => r.receipt_number)).toEqual(['X1', 'X2', 'X3'])
  })

  it('8. montrealDateTimeLabel (inverno e verão)', () => {
    expect(montrealDateTimeLabel(new Date('2026-01-15T17:30:00Z'))).toBe('2026-01-15 12:30')
    expect(montrealDateTimeLabel(new Date('2026-07-01T16:05:00Z'))).toBe('2026-07-01 12:05')
  })

  it('9. reportFileName', () => {
    expect(reportFileName('recibos', yearPeriod(2026))).toBe('recibos-2026.xlsx')
    expect(reportFileName('recibos', { from: '2026-01-01', to: '2026-03-31' })).toBe(
      'recibos-2026-01-01_2026-03-31.xlsx',
    )
  })

  it('10. buildReportSheets: abas, linhas, totais e datas', () => {
    const summary = summarizeReport(sampleRows(), period2026)
    const sheets = sheetsFor(sampleRows())
    expect(sheets.map(s => s.sheet)).toEqual([
      'receipts.report.xlsx.sheetSummary',
      'receipts.report.xlsx.sheetIssued',
      'receipts.report.xlsx.sheetVoided',
    ])

    const issuedData = sheets[1].data
    expect(issuedData[0]).toHaveLength(7)
    expect(issuedData).toHaveLength(summary.issued.length + 2)
    expect(cellValues(issuedData)).not.toContain('K-2026-0002')
    expect(cellValues(sheets[2].data)).toContain('K-2026-0002')

    const last = issuedData[issuedData.length - 1]
    expect(last[4]).toMatchObject({ value: 85.3, format: '#,##0.00' })
    expect(last[5]).toMatchObject({ value: 19.99, format: '#,##0.00' })
    expect(last[6]).toMatchObject({ value: 105.29, format: '#,##0.00' })

    const first = issuedData[1]
    expect(first[0]).toBe('K-2026-0001')
    expect(first[1].value).toBeInstanceOf(Date)
    expect(first[1].value.getTime()).toBe(new Date(Date.UTC(2026, 0, 1)).getTime())
    expect(first[1].format).toBe('yyyy-mm-dd')
  })

  it('11. nome: patient_name, senão o perfil, senão "—"', () => {
    const rows = [
      row({ receipt_number: 'K-1', issued_at: '2026-04-01T15:00:00Z', patient_name: 'Nome Impresso', student_id: 'a' }),
      row({ receipt_number: 'K-2', issued_at: '2026-04-02T15:00:00Z', patient_name: null, student_id: 'b' }),
      row({ receipt_number: 'K-3', issued_at: '2026-04-03T15:00:00Z', patient_name: '  ', student_id: 'c' }),
    ]
    const sheets = sheetsFor(rows, { studentNames: { a: 'Perfil A', b: 'Perfil B' } })
    const names = sheets[1].data.slice(1, 4).map(r => r[2])
    expect(names).toEqual(['Nome Impresso', 'Perfil B', '—'])
  })

  it('12. privacidade: campos a mais não vão para o arquivo', () => {
    const rows = [
      row({
        issued_at: '2026-04-01T15:00:00Z',
        snapshot: { patient: { dateOfBirth: '1980-04-02', phone: '514-555-0000' } },
        void_reason: 'segredo',
      }),
      row({
        receipt_number: 'K-2026-0009',
        issued_at: '2026-04-02T15:00:00Z',
        status: 'void',
        voided_at: '2026-04-03T15:00:00Z',
        snapshot: { patient: { dateOfBirth: '1980-04-02', phone: '514-555-0000' } },
        void_reason: 'segredo',
      }),
    ]
    const json = JSON.stringify(sheetsFor(rows))
    expect(json).not.toContain('1980-04-02')
    expect(json).not.toContain('514-555-0000')
    expect(json).not.toContain('segredo')
  })

  it('13. nome que parece fórmula fica texto simples', () => {
    const sheets = sheetsFor([row({ issued_at: '2026-04-01T15:00:00Z', patient_name: '=SUM(A1:A9)' })])
    const cell = sheets[1].data[1][2]
    expect(typeof cell).toBe('string')
    expect(cell).toBe('=SUM(A1:A9)')
    expect(JSON.stringify(sheets)).not.toContain('Formula')
  })

  describe('14. arquivo .xlsx de verdade, com os textos reais', () => {
    const tFor = lang => {
      const json = JSON.parse(
        readFileSync(fileURLToPath(new URL(`../locales/${lang}.json`, import.meta.url)), 'utf8'),
      )
      return (key, opts = {}) =>
        key
          .split('.')
          .reduce((o, k) => o?.[k], json)
          .replace(/\{\{(\w+)\}\}/g, (_, n) => String(opts[n]))
    }

    for (const lang of ['pt', 'en', 'fr']) {
      it(`${lang}: gera .xlsx (com recibos e vazio)`, async () => {
        const tReal = tFor(lang)
        for (const summary of [summarizeReport(sampleRows(), period2026), summarizeReport([], yearPeriod(2026))]) {
          const blob = await writeXlsxFile(
            buildReportSheets(summary, { t: tReal, period: period2026, generatedAt: '2026-11-21 10:00' }),
          ).toBlob()
          const bytes = new Uint8Array(await blob.arrayBuffer())
          expect(bytes[0]).toBe(0x50)
          expect(bytes[1]).toBe(0x4b)
          expect(blob.size).toBeGreaterThan(1000)
        }
      })
    }
  })
})
