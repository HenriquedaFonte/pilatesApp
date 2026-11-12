// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PDFDocument, PDFName, PDFRef } from 'pdf-lib'
import { generateReceiptPdf, formatMoney, formatDate } from '@/lib/receiptPdf'
import { RECEIPT_FIELDS } from '@/lib/receiptPdfFields'

const template = name =>
  readFileSync(fileURLToPath(new URL(`../assets/receipt-templates/${name}.pdf`, import.meta.url)))

// PNG 1×1 válido
const PNG_1X1 = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
  ),
  c => c.charCodeAt(0)
)

const base = type => ({
  type,
  receiptNumber: type === 'kinesitherapy' ? 'K-2026-0001' : 'N-2026-0001',
  issuedAt: '2026-11-12',
  patient: { fullName: 'Hélène Côté-Gagné', dateOfBirth: '1985-03-07', cityProvince: 'Montréal, QC', phone: '514-555-0101' },
  holder: { isSelf: true },
  policyNumber: 'ABC-123',
  practitioner: { name: 'Josiane Pratique', kinesitherapyLicense: 'K-999', naturopathyLicense: 'N-888' },
  signaturePngBytes: PNG_1X1,
  treatments: [
    { date: '2026-10-01', amount: 85 },
    { date: '2026-10-08', amount: '85.5' },
  ],
  products: [],
})

const opts = type => ({ templateBytes: template(RECEIPT_FIELDS[type].template) })

async function reload(bytes) {
  const doc = await PDFDocument.load(bytes)
  const page = doc.getPage(0)
  // Nenhuma referência quebrada em /Annots (o "Text1" solto do template)
  const annots = page.node.Annots()
  for (const ref of annots ? annots.asArray() : []) {
    if (ref instanceof PDFRef) expect(doc.context.lookup(ref)).toBeDefined()
  }
  // Todo XObject da página é Form ou Image (as aparências do PDFill não têm /Subtype)
  const xobjects = page.node.Resources().lookup(PDFName.of('XObject'))
  for (const [, ref] of xobjects ? xobjects.entries() : []) {
    const subtype = String(doc.context.lookup(ref).dict.get(PDFName.of('Subtype')))
    expect(['/Form', '/Image']).toContain(subtype)
  }
  return { doc, fields: doc.getForm().getFields() }
}

describe('generateReceiptPdf', () => {
  it('gera o recibo de kinésithérapie: 1 página, sem campos editáveis', async () => {
    const bytes = await generateReceiptPdf(base('kinesitherapy'), opts('kinesitherapy'))
    expect(bytes).toBeInstanceOf(Uint8Array)
    const { doc, fields } = await reload(bytes)
    expect(doc.getPageCount()).toBe(1)
    expect(fields).toHaveLength(0)
  })

  it('gera o recibo de naturopathie com produtos e titular diferente', async () => {
    const data = {
      ...base('naturopathy'),
      holder: {
        isSelf: false,
        fullName: 'François Lefèvre',
        cityProvince: 'Laval, QC',
        employer: 'Société Ça Va',
        occupation: 'Ingénieur',
        phoneWork: '514-555-0102',
        phoneHome: '450-555-0103',
      },
      products: [
        { name: 'Échinacée', price: 12.5 },
        { name: 'Tisane', price: 8 },
      ],
      totals: { fees: 170.5, products: 20.5 },
    }
    const { doc, fields } = await reload(await generateReceiptPdf(data, opts('naturopathy')))
    expect(doc.getPageCount()).toBe(1)
    expect(fields).toHaveLength(0)
  })

  it('aceita 10 tratamentos e recusa 11', async () => {
    const t = n => Array.from({ length: n }, (_, i) => ({ date: `2026-10-${String(i + 1).padStart(2, '0')}`, amount: 85 }))
    await expect(
      generateReceiptPdf({ ...base('kinesitherapy'), treatments: t(10) }, opts('kinesitherapy'))
    ).resolves.toBeInstanceOf(Uint8Array)
    await expect(
      generateReceiptPdf({ ...base('kinesitherapy'), treatments: t(11) }, opts('kinesitherapy'))
    ).rejects.toThrow(/Too many treatments/)
  })

  it('recusa produtos no kinésithérapie e mais de 4 no naturopathie', async () => {
    const p = n => Array.from({ length: n }, () => ({ name: 'X', price: 1 }))
    await expect(
      generateReceiptPdf({ ...base('kinesitherapy'), products: p(1) }, opts('kinesitherapy'))
    ).rejects.toThrow(/not allowed/)
    await expect(
      generateReceiptPdf({ ...base('naturopathy'), products: p(5) }, opts('naturopathy'))
    ).rejects.toThrow(/Too many products/)
  })

  it('recusa total que não bate, número de outro tipo e lista vazia', async () => {
    await expect(
      generateReceiptPdf({ ...base('kinesitherapy'), totals: { fees: 100 } }, opts('kinesitherapy'))
    ).rejects.toThrow(/Total fees/)
    await expect(
      generateReceiptPdf({ ...base('kinesitherapy'), receiptNumber: 'N-2026-0001' }, opts('kinesitherapy'))
    ).rejects.toThrow(/does not match type/)
    await expect(
      generateReceiptPdf({ ...base('kinesitherapy'), treatments: [] }, opts('kinesitherapy'))
    ).rejects.toThrow(/At least one/)
  })

  it('aceita número provisório (prévia) e não quebra com caractere fora da fonte', async () => {
    const data = {
      ...base('kinesitherapy'),
      receiptNumber: 'PRÉVIA',
      patient: { ...base('kinesitherapy').patient, fullName: 'Łukasz Wójcik 李' },
      signaturePngBytes: undefined,
    }
    const { fields } = await reload(await generateReceiptPdf(data, opts('kinesitherapy')))
    expect(fields).toHaveLength(0)
  })

  it('recusa assinatura que não é PNG nem JPEG', async () => {
    await expect(
      generateReceiptPdf(
        { ...base('kinesitherapy'), signaturePngBytes: new Uint8Array([1, 2, 3, 4]) },
        opts('kinesitherapy')
      )
    ).rejects.toThrow(/PNG or JPEG/)
  })
})

describe('formatação', () => {
  it('valores com 2 casas e vírgula', () => {
    expect(formatMoney(8500)).toBe('85,00')
    expect(formatMoney(8550)).toBe('85,50')
    expect(formatMoney(5)).toBe('0,05')
  })

  it('datas AAAA-MM-JJ, Date convertida para Montréal', () => {
    expect(formatDate('2026-11-12')).toBe('2026-11-12')
    expect(formatDate('2026-11-12T10:00:00Z')).toBe('2026-11-12')
    // 03:00 UTC do dia 13 ainda é dia 12 em Montréal
    expect(formatDate(new Date('2026-11-13T03:00:00Z'))).toBe('2026-11-12')
    expect(() => formatDate('12/11/2026')).toThrow()
  })
})
