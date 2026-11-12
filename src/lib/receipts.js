// Regras e formatação dos recibos de seguro na tela da professora (Story 3.5).
// Sem acesso ao Supabase aqui (testável): as chamadas ficam em receiptService.js.

export const MAX_TREATMENTS = 10
export const MAX_PRODUCTS = 4
export const RECEIPT_TYPES = ['kinesitherapy', 'naturopathy']
export const PREVIEW_NUMBER = 'PRÉVIA'
export const VOID_REASON_MAX = 500

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
// Até 5 dígitos inteiros e 2 decimais, com vírgula ou ponto (o banco aceita < 100000).
const AMOUNT_RE = /^\d{1,5}(?:[.,]\d{1,2})?$/

// Data de hoje em Montréal (AAAA-MM-DD), a mesma regra do servidor.
export function todayMontreal(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Montreal',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

export function isValidDateString(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false
  const d = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value
}

// "85", "85,5", "85.50" → 8550 (centavos). Inválido ou vazio → null.
export function parseAmountToCents(value) {
  const s = String(value ?? '').trim()
  if (!AMOUNT_RE.test(s)) return null
  const [int, dec = ''] = s.replace(',', '.').split('.')
  return Number(int) * 100 + Number(dec.padEnd(2, '0'))
}

export const centsToNumber = cents => Math.round(cents) / 100

const trimOrEmpty = v => (v === null || v === undefined ? '' : String(v).trim())

// Linhas da tela → { count, feesCents, productsCents } (linhas inválidas valem 0).
export function computeTotals(treatments = [], products = []) {
  const sum = (rows, key) => rows.reduce((s, r) => s + (parseAmountToCents(r[key]) ?? 0), 0)
  return {
    count: treatments.length,
    feesCents: sum(treatments, 'amount'),
    productsCents: sum(products, 'price'),
  }
}

// Valida o formulário da emissão. Devolve { ok, errors } em que errors tem
// chaves i18n (receipts.validation.*): por campo, por linha e gerais.
export function validateReceiptForm(form, today = todayMontreal()) {
  const errors = { general: [], treatments: [], products: [], fields: {} }
  const { type, patient = {}, practitioner = {}, treatments = [], products = [] } = form

  if (!RECEIPT_TYPES.includes(type)) errors.general.push('receipts.validation.type')
  if (!trimOrEmpty(patient.fullName)) errors.fields.patientFullName = 'receipts.validation.required'
  if (trimOrEmpty(patient.dateOfBirth) && !isValidDateString(patient.dateOfBirth)) {
    errors.fields.patientDateOfBirth = 'receipts.validation.invalidDate'
  }
  if (!trimOrEmpty(practitioner.name)) errors.fields.practitionerName = 'receipts.validation.required'

  if (treatments.length === 0) errors.general.push('receipts.validation.atLeastOneTreatment')
  if (treatments.length > MAX_TREATMENTS) errors.general.push('receipts.validation.tooManyTreatments')
  treatments.forEach((row, i) => {
    const rowErrors = {}
    if (!isValidDateString(row.date)) rowErrors.date = 'receipts.validation.invalidDate'
    else if (row.date > today) rowErrors.date = 'receipts.validation.futureDate'
    const cents = parseAmountToCents(row.amount)
    if (cents === null || cents <= 0) rowErrors.amount = 'receipts.validation.invalidAmount'
    if (Object.keys(rowErrors).length) errors.treatments[i] = rowErrors
  })

  if (type !== 'naturopathy' && products.length > 0) {
    errors.general.push('receipts.validation.productsOnlyNaturopathy')
  }
  if (products.length > MAX_PRODUCTS) errors.general.push('receipts.validation.tooManyProducts')
  products.forEach((row, i) => {
    const rowErrors = {}
    const name = trimOrEmpty(row.name)
    if (!name || name.length > 200) rowErrors.name = 'receipts.validation.required'
    const cents = parseAmountToCents(row.price)
    if (cents === null || cents <= 0) rowErrors.price = 'receipts.validation.invalidAmount'
    if (Object.keys(rowErrors).length) errors.products[i] = rowErrors
  })

  const ok =
    errors.general.length === 0 &&
    Object.keys(errors.fields).length === 0 &&
    errors.treatments.filter(Boolean).length === 0 &&
    errors.products.filter(Boolean).length === 0
  return { ok, errors }
}

// Formulário (já validado) → snapshot gravado no recibo. É o mesmo conteúdo
// que vai para o PDF; o PDF é sempre gerado a partir dele (emissão e "Gerar PDF").
// Só a licença do tipo escolhido entra. signaturePath permite regenerar o PDF.
export function buildSnapshot(form, { license, signaturePath }) {
  const holderIsSelf = form.holder?.isSelf !== false
  const treatments = form.treatments.map(r => ({
    date: r.date,
    amount: centsToNumber(parseAmountToCents(r.amount)),
  }))
  const products =
    form.type === 'naturopathy'
      ? form.products.map(r => ({
          name: trimOrEmpty(r.name),
          price: centsToNumber(parseAmountToCents(r.price)),
        }))
      : []
  return {
    version: 1,
    type: form.type,
    patient: {
      fullName: trimOrEmpty(form.patient.fullName),
      dateOfBirth: trimOrEmpty(form.patient.dateOfBirth),
      cityProvince: trimOrEmpty(form.patient.cityProvince),
      phone: trimOrEmpty(form.patient.phone),
    },
    holder: holderIsSelf
      ? { isSelf: true }
      : {
          isSelf: false,
          fullName: trimOrEmpty(form.holder.fullName),
          cityProvince: trimOrEmpty(form.holder.cityProvince),
          employer: trimOrEmpty(form.holder.employer),
          occupation: trimOrEmpty(form.holder.occupation),
          phoneWork: trimOrEmpty(form.holder.phoneWork),
          phoneHome: trimOrEmpty(form.holder.phoneHome),
        },
    policyNumber: trimOrEmpty(form.policyNumber),
    practitioner:
      form.type === 'kinesitherapy'
        ? { name: trimOrEmpty(form.practitioner.name), kinesitherapyLicense: trimOrEmpty(license) }
        : { name: trimOrEmpty(form.practitioner.name), naturopathyLicense: trimOrEmpty(license) },
    signaturePath: signaturePath || null,
    treatments,
    products,
  }
}

// Recibo gravado (linha de insurance_receipts) → dados do gerador de PDF.
// Tratamentos, produtos e totais vêm das colunas (normalizadas pelo servidor);
// o gerador confere que os totais batem com a soma.
export function pdfDataFromReceipt(receipt, signatureBytes) {
  const s = receipt.snapshot || {}
  return {
    type: receipt.receipt_type,
    receiptNumber: receipt.receipt_number,
    issuedAt: new Date(receipt.issued_at),
    patient: s.patient || {},
    holder: s.holder || { isSelf: true },
    policyNumber: s.policyNumber,
    practitioner: s.practitioner || {},
    signaturePngBytes: signatureBytes || undefined,
    treatments: receipt.treatments || [],
    products: receipt.products || [],
    totals: { fees: Number(receipt.total_fees), products: Number(receipt.total_products) },
  }
}

// Prévia: snapshot ainda não gravado, número provisório e data de hoje.
export function pdfDataFromSnapshot(snapshot, signatureBytes, now = new Date()) {
  return {
    type: snapshot.type,
    receiptNumber: PREVIEW_NUMBER,
    issuedAt: now,
    patient: snapshot.patient,
    holder: snapshot.holder,
    policyNumber: snapshot.policyNumber,
    practitioner: snapshot.practitioner,
    signaturePngBytes: signatureBytes || undefined,
    treatments: snapshot.treatments,
    products: snapshot.products,
  }
}

export const receiptPdfPath = (studentId, receiptId) => `${studentId}/${receiptId}.pdf`

// Erros do servidor (RPCs) e do gerador de PDF são em inglês e internos:
// viram uma chave i18n própria (receipts.errors.*). Nada do texto original
// vai para a tela.
const ERROR_PATTERNS = [
  [/permission denied|row-level security|not authorized|jwt/i, 'receipts.errors.permission'],
  [/student not found/i, 'receipts.errors.studentNotFound'],
  [/receipt not found/i, 'receipts.errors.receiptNotFound'],
  [/already void/i, 'receipts.errors.alreadyVoid'],
  [/reason is required|void reason/i, 'receipts.errors.reasonRequired'],
  [/cannot be in the future/i, 'receipts.errors.futureDate'],
  [/treatment|amount|price|product|total/i, 'receipts.errors.invalidData'],
  [/signature/i, 'receipts.errors.signature'],
  [/template/i, 'receipts.errors.template'],
  [/failed to fetch|network|load failed/i, 'receipts.errors.network'],
]

export function receiptErrorKey(err, fallback = 'receipts.errors.generic') {
  const msg = String(err?.message ?? err ?? '')
  for (const [re, key] of ERROR_PATTERNS) if (re.test(msg)) return key
  return fallback
}

// Storage: o arquivo já existe (retentativa depois de um upload que deu certo).
export function isAlreadyExistsError(err) {
  if (!err) return false
  return (
    String(err.statusCode) === '409' ||
    err.status === 409 ||
    /already exists|duplicate/i.test(String(err.message ?? ''))
  )
}

// Datas dos tratamentos para a lista: até 3 datas; acima disso, "primeira – última (n)".
export function summarizeTreatmentDates(treatments = []) {
  const dates = treatments.map(t => t?.date).filter(Boolean).sort()
  if (dates.length <= 3) return dates.join(', ')
  return `${dates[0]} – ${dates[dates.length - 1]} (${dates.length})`
}

// Valores em dólar canadense, no formato da língua da tela.
export const moneyFormatter = lang =>
  new Intl.NumberFormat(lang === 'en' ? 'en-CA' : lang === 'fr' ? 'fr-CA' : 'pt-BR', {
    style: 'currency',
    currency: 'CAD',
  })

// iPhone/iPad (inclusive iPadOS, que se apresenta como Mac com tela de toque).
// Nesses aparelhos o PDF abre no visualizador do Safari (ver e compartilhar)
// em vez de ser baixado (Story 3.6).
export function isAppleMobileDevice(nav = typeof navigator !== 'undefined' ? navigator : undefined) {
  if (!nav) return false
  const ua = String(nav.userAgent || '')
  if (/iPad|iPhone|iPod/.test(ua)) return true
  return /Macintosh/.test(ua) && Number(nav.maxTouchPoints) > 1
}

// Celular/tablet (iOS ou Android): mostra o botão "Compartilhar" (Web Share).
export function isMobileDevice(nav = typeof navigator !== 'undefined' ? navigator : undefined) {
  if (!nav) return false
  return isAppleMobileDevice(nav) || /Android/i.test(String(nav.userAgent || ''))
}

export const receiptFileName = receipt => `${receipt.receipt_number}.pdf`
