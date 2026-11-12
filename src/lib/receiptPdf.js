// Gerador do recibo de seguro em PDF a partir dos formulários oficiais da CPMDQ
// (Story 3.4). Roda no navegador; não precisa de Edge Function.
//
// generateReceiptPdf(data, options?) → Promise<Uint8Array>
//
// data = {
//   type: 'kinesitherapy' | 'naturopathy',
//   receiptNumber: 'K-2026-0001' | 'N-2026-0001' | texto provisório ('PRÉVIA'),
//   issuedAt: 'AAAA-MM-JJ' | Date (Date é convertida para a data de Montréal),
//   patient: { fullName, dateOfBirth?, cityProvince?, phone? },
//   holder: { isSelf, fullName?, cityProvince?, employer?, occupation?,
//             phoneWork?, phoneHome? },
//   policyNumber?,
//   practitioner: { name, kinesitherapyLicense?, naturopathyLicense? },
//   signaturePngBytes?: Uint8Array (PNG ou JPEG),
//   treatments: [{ date: 'AAAA-MM-JJ', amount }]   (1 a 10),
//   products:   [{ name, price }]                  (0 a 4, só naturopathy),
//   totals?: { fees, products }  (se vier, tem de bater com a soma)
// }
//
// options.templateBytes: bytes do template (testes); senão é baixado do bundle.

import { PDFDocument, PDFRef, PDFTextField, StandardFonts, TextAlignment, rgb } from 'pdf-lib'
import kinesitherapieUrl from '@/assets/receipt-templates/kinesitherapie.pdf?url'
import naturopathieUrl from '@/assets/receipt-templates/naturopathie.pdf?url'
import { RECEIPT_FIELDS } from './receiptPdfFields'

const TEMPLATE_URLS = {
  kinesitherapie: kinesitherapieUrl,
  naturopathie: naturopathieUrl,
}

const MAX_TREATMENTS = 10
const MAX_FONT_SIZE = 10
const MIN_FONT_SIZE = 6
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const templateCache = new Map()

async function loadTemplate(name) {
  if (!templateCache.has(name)) {
    const promise = fetch(TEMPLATE_URLS[name]).then(res => {
      if (!res.ok) throw new Error(`Receipt template not found: ${name}`)
      return res.arrayBuffer()
    })
    promise.catch(() => templateCache.delete(name))
    templateCache.set(name, promise)
  }
  return templateCache.get(name)
}

// ---- Formatação ------------------------------------------------------------

function toCents(value, label) {
  const n = typeof value === 'string' ? Number(value.replace(',', '.')) : Number(value)
  if (value === null || value === undefined || value === '' || !Number.isFinite(n) || n < 0) {
    throw new Error(`Invalid amount for ${label}: ${value}`)
  }
  return Math.round(n * 100)
}

export function formatMoney(cents) {
  return (cents / 100).toFixed(2).replace('.', ',')
}

export function formatDate(value, label = 'date') {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new Error(`Invalid ${label}`)
    // en-CA dá AAAA-MM-JJ
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Montreal',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(value)
  }
  const s = typeof value === 'string' ? value.slice(0, 10) : ''
  if (!DATE_RE.test(s) || Number.isNaN(Date.parse(`${s}T00:00:00Z`))) {
    throw new Error(`Invalid ${label}: ${value}`)
  }
  return s
}

const clean = v => (v === null || v === undefined ? '' : String(v).replace(/\s+/g, ' ').trim())

// Fontes padrão do PDF usam WinAnsi: é, è, ç, à etc. funcionam. Caracteres fora
// dela perdem o acento (ł → l) ou viram "?", em vez de quebrar a geração.
function toFontCharset(text, charset) {
  let out = ''
  for (const ch of text) {
    if (charset.has(ch.codePointAt(0))) {
      out += ch
      continue
    }
    const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '')
    out += [...base].every(c => charset.has(c.codePointAt(0))) && base ? base : '?'
  }
  return out
}

// ---- Validação -------------------------------------------------------------

function validate(data) {
  if (!data || typeof data !== 'object') throw new Error('Receipt data is required')
  const map = RECEIPT_FIELDS[data.type]
  if (!map) throw new Error(`Invalid receipt type: ${data.type}`)

  const receiptNumber = clean(data.receiptNumber)
  if (!receiptNumber) throw new Error('Receipt number is required')
  const m = /^([A-Z])-\d{4}-\d{4,}$/.exec(receiptNumber)
  if (m && m[1] !== map.letter) {
    throw new Error(`Receipt number ${receiptNumber} does not match type ${data.type}`)
  }

  if (!clean(data.patient?.fullName)) throw new Error('Patient name is required')
  if (!clean(data.practitioner?.name)) throw new Error('Practitioner name is required')

  const treatments = data.treatments
  if (!Array.isArray(treatments) || treatments.length === 0) {
    throw new Error('At least one treatment is required')
  }
  if (treatments.length > MAX_TREATMENTS) {
    throw new Error(`Too many treatments: ${treatments.length} (max ${MAX_TREATMENTS})`)
  }
  const products = data.products ?? []
  if (!Array.isArray(products)) throw new Error('Products must be an array')
  if (products.length > map.products.length) {
    throw new Error(
      map.products.length === 0
        ? `Products are not allowed on a ${data.type} receipt`
        : `Too many products: ${products.length} (max ${map.products.length})`
    )
  }

  const rows = treatments.map((t, i) => {
    const cents = toCents(t?.amount, `treatment ${i + 1}`)
    if (cents === 0) throw new Error(`Treatment ${i + 1} amount must be greater than zero`)
    return { date: formatDate(t?.date, `treatment ${i + 1} date`), cents }
  })
  const productRows = products.map((p, i) => {
    const name = clean(p?.name)
    if (!name) throw new Error(`Product ${i + 1} name is required`)
    return { name, cents: toCents(p?.price, `product ${i + 1}`) }
  })

  const feesCents = rows.reduce((s, r) => s + r.cents, 0)
  const productsCents = productRows.reduce((s, r) => s + r.cents, 0)
  if (data.totals?.fees !== undefined && toCents(data.totals.fees, 'total fees') !== feesCents) {
    throw new Error('Total fees does not match the sum of treatments')
  }
  if (
    data.totals?.products !== undefined &&
    toCents(data.totals.products, 'total products') !== productsCents
  ) {
    throw new Error('Total products does not match the sum of products')
  }

  return { map, receiptNumber, rows, productRows, feesCents, productsCents }
}

// ---- Geração ---------------------------------------------------------------

// Prepara o template gerado no PDFill: as aparências originais não têm
// /Subtype /Form, e o flatten as copiaria quebradas para a página (leitores
// reclamam). Todo campo é zerado para que updateFieldAppearances gere
// aparências novas para todos, inclusive os que ficam vazios.
// Obs.: o de kinésithérapie tem um segundo campo "Text1" solto embaixo da
// assinatura. getTextField('Text1') pega o primeiro (o do titular); o outro
// fica vazio. Não é removido porque o template ainda o referencia em outro
// lugar e removê-lo deixaria uma referência quebrada no PDF.
function prepareForm(form) {
  for (const field of form.getFields()) {
    if (field instanceof PDFTextField) field.setText('')
  }
}

// O flatten apaga o widget do "Text1" solto mas deixa a referência em /Annots
// da página (referência quebrada). Tira da lista o que não existe mais.
function removeDanglingAnnots(pdf, page) {
  const annots = page.node.Annots()
  if (!annots) return
  for (let i = annots.size() - 1; i >= 0; i--) {
    const ref = annots.get(i)
    if (ref instanceof PDFRef && !pdf.context.lookup(ref)) annots.remove(i)
  }
}

function fittedFontSize(font, text, rect) {
  if (!text) return MAX_FONT_SIZE
  const byWidth = (rect.width - 4) / font.widthOfTextAtSize(text, 1)
  const byHeight = rect.height * 0.7
  return Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, byWidth, byHeight))
}

function isPng(bytes) {
  return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
}
function isJpeg(bytes) {
  return bytes[0] === 0xff && bytes[1] === 0xd8
}

export async function generateReceiptPdf(data, options = {}) {
  const { map, receiptNumber, rows, productRows, feesCents, productsCents } = validate(data)

  const templateBytes = options.templateBytes ?? (await loadTemplate(map.template))
  const pdf = await PDFDocument.load(templateBytes)
  const form = pdf.getForm()
  prepareForm(form)

  const font = await pdf.embedFont(StandardFonts.TimesRomanBold)
  const charset = new Set(font.getCharacterSet())

  const setField = (name, value, align) => {
    const field = form.getTextField(name)
    const text = toFontCharset(clean(value), charset)
    const rect = field.acroField.getWidgets()[0].getRectangle()
    field.setText(text)
    field.setFontSize(fittedFontSize(font, text, rect))
    if (align) field.setAlignment(align)
  }

  const patient = data.patient
  const holder = data.holder?.isSelf === false
    ? data.holder
    : {
        fullName: patient.fullName,
        cityProvince: patient.cityProvince,
        phoneHome: patient.phone,
      }

  setField(map.holderFullName, holder.fullName)
  setField(map.holderCityProvince, holder.cityProvince)
  setField(map.holderEmployer, holder.employer)
  setField(map.holderOccupation, holder.occupation)
  setField(map.holderPhoneWork, holder.phoneWork)
  setField(map.holderPhoneHome, holder.phoneHome)
  setField(map.patientFullName, patient.fullName)
  setField(
    map.patientDateOfBirth,
    patient.dateOfBirth ? formatDate(patient.dateOfBirth, 'patient date of birth') : ''
  )
  setField(map.policyNumber, data.policyNumber)

  rows.forEach((row, i) => {
    const [dateField, amountField] = map.treatments[i]
    setField(dateField, row.date, TextAlignment.Center)
    setField(amountField, formatMoney(row.cents), TextAlignment.Right)
  })
  productRows.forEach((row, i) => {
    const [nameField, priceField] = map.products[i]
    setField(nameField, row.name, TextAlignment.Left)
    setField(priceField, formatMoney(row.cents), TextAlignment.Right)
  })
  if (map.totalProducts && productRows.length > 0) {
    setField(map.totalProducts, formatMoney(productsCents), TextAlignment.Right)
  }

  setField(map.consultationsCount, String(rows.length), TextAlignment.Center)
  setField(map.totalFees, formatMoney(feesCents))

  const license =
    data.type === 'kinesitherapy'
      ? data.practitioner.kinesitherapyLicense
      : data.practitioner.naturopathyLicense
  setField(map.practitionerName, data.practitioner.name)
  setField(map.practitionerLicense, license)
  setField(map.signatureDate, formatDate(data.issuedAt ?? new Date(), 'issue date'))

  // A área da assinatura fica sem texto; a imagem é desenhada por cima depois
  // do flatten (o campo de kinésithérapie não tem aparência própria, por isso
  // não dá para removê-lo antes).
  setField(map.signature, '')
  const sigRect = form.getTextField(map.signature).acroField.getWidgets()[0].getRectangle()

  form.updateFieldAppearances(font)
  form.flatten()

  const page = pdf.getPage(0)
  removeDanglingAnnots(pdf, page)

  const sig = data.signaturePngBytes
  if (sig && sig.length > 0) {
    const bytes = sig instanceof Uint8Array ? sig : new Uint8Array(sig)
    let image
    if (isPng(bytes)) image = await pdf.embedPng(bytes)
    else if (isJpeg(bytes)) image = await pdf.embedJpg(bytes)
    else throw new Error('Signature must be a PNG or JPEG image')
    const pad = 1
    const scale = Math.min(
      (sigRect.width - 2 * pad) / image.width,
      (sigRect.height - 2 * pad) / image.height
    )
    const w = image.width * scale
    const h = image.height * scale
    page.drawImage(image, {
      x: sigRect.x + pad,
      y: sigRect.y + (sigRect.height - h) / 2,
      width: w,
      height: h,
    })
  }

  // Número do recibo no rodapé, abaixo do texto institucional do formulário.
  const footerFont = await pdf.embedFont(StandardFonts.Helvetica)
  const footer = toFontCharset(`Reçu nº ${receiptNumber}`, new Set(footerFont.getCharacterSet()))
  const footerSize = 7
  const { width } = page.getSize()
  page.drawText(footer, {
    x: width - 36 - footerFont.widthOfTextAtSize(footer, footerSize),
    y: 18,
    size: footerSize,
    font: footerFont,
    color: rgb(0.4, 0.4, 0.4),
  })

  return pdf.save()
}
