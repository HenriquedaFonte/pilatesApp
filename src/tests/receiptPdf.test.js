// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PDFDocument, PDFName, PDFRawStream, PDFRef, decodePDFRawStream } from 'pdf-lib'
import { generateReceiptPdf, formatMoney, formatDate } from '@/lib/receiptPdf'
import { RECEIPT_FIELDS } from '@/lib/receiptPdfFields'
import { drawnTexts } from './pdfText'

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
  return { doc, fields: doc.getForm().getFields(), textColors: fieldTextColors(doc, xobjects) }
}

// Operadores de cor usados nas aparências dos campos (viram XObjects no flatten)
function fieldTextColors(doc, xobjects) {
  const colors = new Set()
  for (const [name, ref] of xobjects ? xobjects.entries() : []) {
    const obj = doc.context.lookup(ref)
    if (!String(name).startsWith('/FlatWidget') || !(obj instanceof PDFRawStream)) continue
    const content = new TextDecoder('latin1').decode(decodePDFRawStream(obj).decode())
    const text = content.replace(/\((?:\\.|[^\\)])*\)/g, '') // ignora o texto dos campos
    for (const m of text.matchAll(/(?:[\d.]+\s+){0,3}[\d.]+\s+(?:rg|g|k)\b/g)) {
      colors.add(m[0].replace(/\s+/g, ' '))
    }
  }
  return colors
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

  it('preenche os dois formulários em preto (o naturopathie vem em azul no template)', async () => {
    for (const type of ['kinesitherapy', 'naturopathy']) {
      const { textColors } = await reload(await generateReceiptPdf(base(type), opts(type)))
      expect(textColors.size).toBeGreaterThan(0)
      for (const color of textColors) expect(['0 g', '0 0 0 rg', '0 0 0 1 k']).toContain(color)
    }
  })

  it('nome do produto centralizado (o template vem alinhado à direita)', async () => {
    const data = { ...base('naturopathy'), products: [{ name: 'Tisane', price: 8 }] }
    const bytes = await generateReceiptPdf(data, opts('naturopathy'))
    const doc = await PDFDocument.load(bytes)
    const xobjects = doc.getPage(0).node.Resources().lookup(PDFName.of('XObject'))
    const hex = [...'Tisane'].map(c => c.charCodeAt(0).toString(16).toUpperCase()).join('')
    let x
    for (const [name, ref] of xobjects.entries()) {
      const obj = doc.context.lookup(ref)
      if (!String(name).startsWith('/FlatWidget') || !(obj instanceof PDFRawStream)) continue
      const content = new TextDecoder('latin1').decode(decodePDFRawStream(obj).decode())
      const m = new RegExp(`1 0 0 1 ([\\d.-]+) [\\d.-]+ Tm\\s*<${hex}>`, 'i').exec(content)
      if (m) x = Number(m[1])
    }
    expect(x).toBeDefined()
    // caixa de ~185 pt, "Tisane" ~28 pt: centralizado ≈ 78; à direita seria ≈ 156
    expect(x).toBeGreaterThan(60)
    expect(x).toBeLessThan(100)
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

  it('data ao lado da assinatura = último tratamento (fora de ordem), não a emissão', async () => {
    for (const type of ['kinesitherapy', 'naturopathy']) {
      const data = {
        ...base(type),
        issuedAt: '2026-11-12',
        treatments: [
          { date: '2026-11-03', amount: 85 },
          { date: '2026-11-10', amount: 85 },
          { date: '2026-11-05', amount: 85 },
        ],
      }
      const texts = await drawnTexts(await generateReceiptPdf(data, opts(type)))
      // 1 vez na linha do tratamento + 1 vez ao lado da assinatura
      expect(texts.filter(t => t === '2026-11-10')).toHaveLength(2)
      expect(texts.filter(t => t === '2026-11-03')).toHaveLength(1)
      expect(texts.filter(t => t === '2026-11-05')).toHaveLength(1)
      expect(texts).not.toContain('2026-11-12')
    }
  })

  it('a emissão pode ser no mesmo dia do último tratamento; depois dela é recusado', async () => {
    const data = { ...base('kinesitherapy'), issuedAt: '2026-10-08' }
    await expect(generateReceiptPdf(data, opts('kinesitherapy'))).resolves.toBeInstanceOf(Uint8Array)
    await expect(
      generateReceiptPdf({ ...data, issuedAt: '2026-10-07' }, opts('kinesitherapy'))
    ).rejects.toThrow(/cannot be in the future/)
    // Date da emissão vira o dia de Montréal: 03:00 UTC do dia 09 ainda é dia 08
    await expect(
      generateReceiptPdf({ ...data, issuedAt: new Date('2026-10-09T03:00:00Z') }, opts('kinesitherapy'))
    ).resolves.toBeInstanceOf(Uint8Array)
  })

  it('o número do recibo não sai no PDF (nem o da prévia)', async () => {
    for (const type of ['kinesitherapy', 'naturopathy']) {
      for (const receiptNumber of [base(type).receiptNumber, 'PRÉVIA']) {
        const texts = await drawnTexts(await generateReceiptPdf({ ...base(type), receiptNumber }, opts(type)))
        expect(texts.length).toBeGreaterThan(0)
        const all = texts.join(' ')
        expect(all).not.toMatch(/Reçu|Re\?u n/)
        expect(all).not.toContain(receiptNumber)
        expect(all).not.toContain('PREVIA')
      }
    }
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
