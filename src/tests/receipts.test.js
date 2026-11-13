// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PDFDocument } from 'pdf-lib'
import { generateReceiptPdf } from '@/lib/receiptPdf'
import { RECEIPT_FIELDS } from '@/lib/receiptPdfFields'
import { drawnTexts } from './pdfText'
import {
  PREVIEW_NUMBER,
  buildSnapshot,
  computeTotals,
  isAlreadyExistsError,
  isValidDateString,
  parseAmountToCents,
  pdfDataFromReceipt,
  pdfDataFromSnapshot,
  receiptErrorKey,
  receiptPdfPath,
  summarizeTreatmentDates,
  todayMontreal,
  validateReceiptForm,
} from '@/lib/receipts'

const template = type =>
  readFileSync(
    fileURLToPath(
      new URL(`../assets/receipt-templates/${RECEIPT_FIELDS[type].template}.pdf`, import.meta.url)
    )
  )

const TODAY = '2026-11-12'

const form = (type = 'kinesitherapy', over = {}) => ({
  type,
  patient: { fullName: ' Hélène Côté ', dateOfBirth: '1985-03-07', cityProvince: 'Montréal, QC', phone: '514-555-0101' },
  policyNumber: 'ABC-123',
  holder: { isSelf: true, fullName: 'ignorado', cityProvince: '', employer: '', occupation: '', phoneWork: '', phoneHome: '' },
  practitioner: { name: 'Josiane' },
  treatments: [
    { key: 1, date: '2026-11-01', amount: '85' },
    { key: 2, date: '2026-11-08', amount: '85,50' },
  ],
  products: [],
  ...over,
})

describe('parseAmountToCents', () => {
  it('aceita vírgula ou ponto, até 2 casas', () => {
    expect(parseAmountToCents('85')).toBe(8500)
    expect(parseAmountToCents('85,5')).toBe(8550)
    expect(parseAmountToCents('85.05')).toBe(8505)
    expect(parseAmountToCents(' 0,10 ')).toBe(10)
  })
  it('recusa vazio, negativo, 3 casas, texto e valores >= 100000', () => {
    for (const v of ['', null, undefined, '-5', '1,234', 'abc', '1.2.3', '100000', '1e3']) {
      expect(parseAmountToCents(v)).toBeNull()
    }
  })
})

describe('datas', () => {
  it('isValidDateString só aceita AAAA-MM-DD existente', () => {
    expect(isValidDateString('2026-02-28')).toBe(true)
    expect(isValidDateString('2026-02-30')).toBe(false)
    expect(isValidDateString('2026-2-3')).toBe(false)
    expect(isValidDateString('')).toBe(false)
  })
  it('todayMontreal usa o fuso de Montréal', () => {
    // 2026-11-13 03:00 UTC = 2026-11-12 22:00 em Montréal
    expect(todayMontreal(new Date('2026-11-13T03:00:00Z'))).toBe('2026-11-12')
  })
})

describe('computeTotals', () => {
  it('soma honorários e produtos separados; linhas inválidas valem 0', () => {
    const t = computeTotals(
      [{ amount: '85' }, { amount: '85,50' }, { amount: 'x' }],
      [{ price: '12,5' }, { price: '8' }]
    )
    expect(t).toEqual({ count: 3, feesCents: 17050, productsCents: 2050 })
  })
})

describe('validateReceiptForm', () => {
  it('formulário completo é válido', () => {
    expect(validateReceiptForm(form(), TODAY).ok).toBe(true)
  })

  it('exige ao menos 1 tratamento', () => {
    const r = validateReceiptForm(form('kinesitherapy', { treatments: [] }), TODAY)
    expect(r.ok).toBe(false)
    expect(r.errors.general).toContain('receipts.validation.atLeastOneTreatment')
  })

  it('recusa data futura, data inválida e valor zero/vazio por linha', () => {
    const r = validateReceiptForm(
      form('kinesitherapy', {
        treatments: [
          { date: '2026-11-13', amount: '85' },
          { date: '', amount: '0' },
          { date: TODAY, amount: '' },
        ],
      }),
      TODAY
    )
    expect(r.ok).toBe(false)
    expect(r.errors.treatments[0]).toEqual({ date: 'receipts.validation.futureDate' })
    expect(r.errors.treatments[1]).toEqual({
      date: 'receipts.validation.invalidDate',
      amount: 'receipts.validation.invalidAmount',
    })
    expect(r.errors.treatments[2]).toEqual({ amount: 'receipts.validation.invalidAmount' })
  })

  it('a data de hoje é aceita', () => {
    const r = validateReceiptForm(form('kinesitherapy', { treatments: [{ date: TODAY, amount: '1' }] }), TODAY)
    expect(r.ok).toBe(true)
  })

  it('máximo 10 tratamentos e 4 produtos; produtos só em naturopathie', () => {
    const eleven = Array.from({ length: 11 }, () => ({ date: '2026-11-01', amount: '10' }))
    expect(validateReceiptForm(form('kinesitherapy', { treatments: eleven }), TODAY).errors.general).toContain(
      'receipts.validation.tooManyTreatments'
    )
    const five = Array.from({ length: 5 }, () => ({ name: 'P', price: '1' }))
    expect(validateReceiptForm(form('naturopathy', { products: five }), TODAY).errors.general).toContain(
      'receipts.validation.tooManyProducts'
    )
    expect(
      validateReceiptForm(form('kinesitherapy', { products: [{ name: 'P', price: '1' }] }), TODAY).errors.general
    ).toContain('receipts.validation.productsOnlyNaturopathy')
  })

  it('produto precisa de nome e preço > 0', () => {
    const r = validateReceiptForm(form('naturopathy', { products: [{ name: ' ', price: '0' }] }), TODAY)
    expect(r.errors.products[0]).toEqual({
      name: 'receipts.validation.required',
      price: 'receipts.validation.invalidAmount',
    })
  })

  it('nome do paciente e da praticante são obrigatórios', () => {
    const r = validateReceiptForm(
      form('kinesitherapy', { patient: { fullName: '' }, practitioner: { name: ' ' } }),
      TODAY
    )
    expect(r.errors.fields).toEqual({
      patientFullName: 'receipts.validation.required',
      practitionerName: 'receipts.validation.required',
    })
  })
})

describe('buildSnapshot', () => {
  it('normaliza valores, só guarda a licença do tipo e ignora o titular quando é o próprio aluno', () => {
    const s = buildSnapshot(form(), { license: 'K-999', signaturePath: 't/signature.png' })
    expect(s.treatments).toEqual([
      { date: '2026-11-01', amount: 85 },
      { date: '2026-11-08', amount: 85.5 },
    ])
    expect(s.products).toEqual([])
    expect(s.holder).toEqual({ isSelf: true })
    expect(s.practitioner).toEqual({ name: 'Josiane', kinesitherapyLicense: 'K-999' })
    expect(s.patient.fullName).toBe('Hélène Côté')
    expect(s.signaturePath).toBe('t/signature.png')
  })

  it('naturopathie leva produtos e licença de naturopathie', () => {
    const s = buildSnapshot(
      form('naturopathy', {
        holder: { isSelf: false, fullName: 'François', cityProvince: 'Laval', employer: 'X', occupation: 'Y', phoneWork: '1', phoneHome: '2' },
        products: [{ name: ' Tisane ', price: '8,25' }],
      }),
      { license: 'N-888', signaturePath: null }
    )
    expect(s.products).toEqual([{ name: 'Tisane', price: 8.25 }])
    expect(s.practitioner).toEqual({ name: 'Josiane', naturopathyLicense: 'N-888' })
    expect(s.holder.isSelf).toBe(false)
    expect(s.holder.fullName).toBe('François')
  })
})

describe('PDF a partir do snapshot e do recibo gravado', () => {
  it('prévia (PRÉVIA) e recibo gravado geram PDF válido, com os totais conferidos', async () => {
    const snapshot = buildSnapshot(
      form('naturopathy', { products: [{ name: 'Échinacée', price: '12,50' }] }),
      { license: 'N-888', signaturePath: null }
    )
    const preview = pdfDataFromSnapshot(snapshot, null, new Date('2026-11-12T15:00:00Z'))
    expect(preview.receiptNumber).toBe(PREVIEW_NUMBER)
    const opts = { templateBytes: template('naturopathy') }
    const previewBytes = await generateReceiptPdf(preview, opts)
    expect((await PDFDocument.load(previewBytes)).getPageCount()).toBe(1)

    // Linha como o banco devolve (numeric vira string no JSON do PostgREST).
    const row = {
      id: 'r1',
      student_id: 's1',
      receipt_type: 'naturopathy',
      receipt_number: 'N-2026-0001',
      issued_at: '2026-11-12T15:00:00+00:00',
      snapshot,
      treatments: snapshot.treatments,
      products: snapshot.products,
      total_fees: '170.50',
      total_products: '12.50',
    }
    const data = pdfDataFromReceipt(row, null)
    expect(data.totals).toEqual({ fees: 170.5, products: 12.5 })
    const bytes = await generateReceiptPdf(data, opts)
    expect((await PDFDocument.load(bytes)).getForm().getFields()).toHaveLength(0)
  })

  it('prévia e recibo gravado: data do último tratamento ao lado da assinatura e sem número', async () => {
    for (const type of ['kinesitherapy', 'naturopathy']) {
      // Fora de ordem: o último tratamento (2026-11-10) está no meio da lista.
      const snapshot = buildSnapshot(
        form(type, {
          treatments: [
            { key: 1, date: '2026-11-03', amount: '85' },
            { key: 2, date: '2026-11-10', amount: '85' },
            { key: 3, date: '2026-11-05', amount: '85' },
          ],
        }),
        { license: 'L-1', signaturePath: null }
      )
      const opts = { templateBytes: template(type) }
      // Prévia gerada dias depois do último tratamento
      const preview = await drawnTexts(
        await generateReceiptPdf(pdfDataFromSnapshot(snapshot, null, new Date('2026-11-13T15:00:00Z')), opts)
      )
      const number = `${RECEIPT_FIELDS[type].letter}-2026-0001`
      const row = {
        receipt_type: type,
        receipt_number: number,
        issued_at: '2026-11-13T15:00:00+00:00',
        snapshot,
        treatments: snapshot.treatments,
        products: [],
        total_fees: '255.00',
        total_products: '0',
      }
      const stored = await drawnTexts(await generateReceiptPdf(pdfDataFromReceipt(row, null), opts))

      for (const texts of [preview, stored]) {
        expect(texts.filter(t => t === '2026-11-10')).toHaveLength(2) // linha + assinatura
        expect(texts).not.toContain('2026-11-13') // dia da emissão não sai
        const all = texts.join(' ')
        expect(all).not.toMatch(/Reçu/)
        expect(all).not.toContain(number)
        expect(all).not.toContain('PREVIA')
      }
      // Os dois caminhos desenham o mesmo texto
      expect(stored).toEqual(preview)
    }
  })

  it('tratamento depois da emissão é recusado pelo gerador (mesma regra do servidor)', async () => {
    const snapshot = buildSnapshot(form(), { license: 'K-1', signaturePath: null })
    // Prévia "no dia 07": o tratamento de 2026-11-08 ainda não aconteceu
    const data = pdfDataFromSnapshot(snapshot, null, new Date('2026-11-07T15:00:00Z'))
    const err = await generateReceiptPdf(data, { templateBytes: template('kinesitherapy') }).catch(e => e)
    expect(err).toBeInstanceOf(Error)
    expect(receiptErrorKey(err)).toBe('receipts.errors.futureDate')
  })

  it('total gravado diferente da soma é recusado pelo gerador', async () => {
    const snapshot = buildSnapshot(form(), { license: 'K-1', signaturePath: null })
    const row = {
      receipt_type: 'kinesitherapy',
      receipt_number: 'K-2026-0001',
      issued_at: '2026-11-12T15:00:00Z',
      snapshot,
      treatments: snapshot.treatments,
      products: [],
      total_fees: '999.00',
      total_products: '0',
    }
    await expect(
      generateReceiptPdf(pdfDataFromReceipt(row, null), { templateBytes: template('kinesitherapy') })
    ).rejects.toThrow(/Total fees/)
  })
})

describe('receiptErrorKey', () => {
  it('traduz erros internos (servidor e gerador) em chaves próprias', () => {
    expect(receiptErrorKey(new Error('permission denied: only the teacher can issue insurance receipts'))).toBe(
      'receipts.errors.permission'
    )
    expect(receiptErrorKey({ message: 'treatment date cannot be in the future' })).toBe('receipts.errors.futureDate')
    expect(receiptErrorKey({ message: 'receipt is already void' })).toBe('receipts.errors.alreadyVoid')
    expect(receiptErrorKey(new Error('Total fees does not match the sum of treatments'))).toBe(
      'receipts.errors.invalidData'
    )
    expect(receiptErrorKey(new Error('Signature must be a PNG or JPEG image'))).toBe('receipts.errors.signature')
    expect(receiptErrorKey(new Error('Receipt template not found: naturopathie'))).toBe('receipts.errors.template')
    expect(receiptErrorKey(new TypeError('Failed to fetch'))).toBe('receipts.errors.network')
    expect(receiptErrorKey(new Error('algo inesperado'))).toBe('receipts.errors.generic')
    expect(receiptErrorKey(null)).toBe('receipts.errors.generic')
  })
})

describe('outros', () => {
  it('caminho do PDF é {student_id}/{receipt_id}.pdf', () => {
    expect(receiptPdfPath('s1', 'r1')).toBe('s1/r1.pdf')
  })
  it('isAlreadyExistsError reconhece o 409 do Storage', () => {
    expect(isAlreadyExistsError({ statusCode: '409', message: 'Duplicate' })).toBe(true)
    expect(isAlreadyExistsError({ message: 'The resource already exists' })).toBe(true)
    expect(isAlreadyExistsError({ statusCode: '403', message: 'new row violates row-level security policy' })).toBe(false)
    expect(isAlreadyExistsError(null)).toBe(false)
  })
  it('summarizeTreatmentDates resume listas longas', () => {
    expect(summarizeTreatmentDates([{ date: '2026-11-08' }, { date: '2026-11-01' }])).toBe('2026-11-01, 2026-11-08')
    expect(
      summarizeTreatmentDates(['2026-10-04', '2026-10-01', '2026-10-03', '2026-10-02'].map(date => ({ date })))
    ).toBe('2026-10-01 – 2026-10-04 (4)')
  })
})
