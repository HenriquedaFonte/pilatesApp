// Relatório fiscal dos recibos de seguro (para o contador). Regras puras e
// montagem das abas do Excel; sem Supabase (chamadas em receiptReportService.js).
// Período = dia de emissão em Montréal (como a numeração e a coluna "Emissão").
// Anulados ficam listados à parte e nunca entram nos totais.
// Dados pessoais: só o nome impresso no recibo (patient_name); nada mais do snapshot.

import { RECEIPT_TYPES, isValidDateString, todayMontreal } from './receipts'

export const FIRST_RECEIPT_YEAR = 2026
export const STUDIO_NAME = 'Josi Pilates'
export const MONEY_FORMAT = '#,##0.00'
export const DATE_FORMAT = 'yyyy-mm-dd'

// NUMERIC do Postgres (número ou texto "85.10") → centavos inteiros.
export const toCents = value => {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}

export const currentMontrealYear = (now = new Date()) => Number(todayMontreal(now).slice(0, 4))

// Anos do seletor, do atual (Montréal) até 2026, do mais novo para o mais antigo.
export function availableYears(now = new Date()) {
  const current = Math.max(currentMontrealYear(now), FIRST_RECEIPT_YEAR)
  const years = []
  for (let y = current; y >= FIRST_RECEIPT_YEAR; y--) years.push(y)
  return years
}

export const yearPeriod = year => ({ from: `${year}-01-01`, to: `${year}-12-31` })

export const isValidPeriod = ({ from, to } = {}) =>
  isValidDateString(from) && isValidDateString(to) && from <= to

const utcMidnightIso = (dateStr, addDays = 0) => {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + addDays)).toISOString()
}

// Janela UTC que contém com folga todos os dias de Montréal do período
// (Montréal é UTC-5/UTC-4). O corte exato é feito em summarizeReport.
export const utcQueryWindow = ({ from, to }) => ({
  gte: utcMidnightIso(from),
  lt: utcMidnightIso(to, 2),
})

export const montrealDay = iso => todayMontreal(new Date(iso))

const emptyTotals = () => ({ count: 0, feesCents: 0, productsCents: 0, totalCents: 0 })

// Linhas lidas do banco → { issued, voided, totals, byType } só do período
// (dia de Montréal), em ordem de emissão (empate: número). Totais só dos emitidos.
export function summarizeReport(rows = [], { from, to } = {}) {
  const inPeriod = rows.filter(r => {
    const day = montrealDay(r.issued_at)
    return day >= from && day <= to
  })
  inPeriod.sort(
    (a, b) =>
      new Date(a.issued_at) - new Date(b.issued_at) ||
      String(a.receipt_number).localeCompare(String(b.receipt_number)),
  )
  const issued = inPeriod.filter(r => r.status === 'issued')
  const voided = inPeriod.filter(r => r.status === 'void')
  const totals = emptyTotals()
  const byType = Object.fromEntries(RECEIPT_TYPES.map(type => [type, emptyTotals()]))
  for (const r of issued) {
    const fees = toCents(r.total_fees)
    const products = toCents(r.total_products)
    for (const acc of [totals, byType[r.receipt_type]]) {
      if (!acc) continue
      acc.count += 1
      acc.feesCents += fees
      acc.productsCents += products
      acc.totalCents += fees + products
    }
  }
  return { issued, voided, totals, byType }
}

// "AAAA-MM-DD HH:mm" na hora de Montréal (linha "Gerado em").
export function montrealDateTimeLabel(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Montreal',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(now)
      .map(p => [p.type, p.value]),
  )
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`
}

// Ano inteiro → "recibos-2026.xlsx"; outro período → "recibos-2026-01-01_2026-03-31.xlsx".
export function reportFileName(prefix, { from, to }) {
  const year = from.slice(0, 4)
  const wholeYear = from === `${year}-01-01` && to === `${year}-12-31`
  return wholeYear ? `${prefix}-${year}.xlsx` : `${prefix}-${from}_${to}.xlsx`
}

// Nome impresso no recibo; senão o nome atual do perfil; senão "—".
export const nameOnReceipt = (r, studentNames = {}) =>
  String(r.patient_name ?? '').trim() || studentNames[r.student_id] || '—'

// Data AAAA-MM-DD → célula de data do Excel (meia-noite UTC = o próprio dia).
const dateCell = dateStr => {
  const [y, m, d] = dateStr.split('-').map(Number)
  return { value: new Date(Date.UTC(y, m - 1, d)), format: DATE_FORMAT }
}
const moneyCell = (cents, extra = {}) => ({ value: cents / 100, format: MONEY_FORMAT, ...extra })
const bold = value => ({ value, fontWeight: 'bold' })

// Abas no formato do write-excel-file (várias abas: [{ sheet, data, columns }]).
// t = função de tradução (i18next) na língua da tela.
export function buildReportSheets(summary, { t, period, generatedAt, studentNames = {} }) {
  const x = (key, opts) => t(`receipts.report.xlsx.${key}`, opts)
  const typeLabel = type => t(`receipts.types.${type}`)
  const { issued, voided, totals, byType } = summary

  const summaryData = [
    [bold(`${STUDIO_NAME} — ${x('title')}`)],
    [x('period'), `${period.from} – ${period.to}`],
    [x('generatedAt'), generatedAt],
    [x('currency')],
    [x('dateNote')],
    [],
    [bold(x('colType')), bold(x('colCount')), bold(x('colFees')), bold(x('colProducts')), bold(x('colTotal'))],
    ...RECEIPT_TYPES.map(type => {
      const s = byType[type]
      return [typeLabel(type), s.count, moneyCell(s.feesCents), moneyCell(s.productsCents), moneyCell(s.totalCents)]
    }),
    [
      bold(x('colTotal')),
      { value: totals.count, fontWeight: 'bold' },
      moneyCell(totals.feesCents, { fontWeight: 'bold' }),
      moneyCell(totals.productsCents, { fontWeight: 'bold' }),
      moneyCell(totals.totalCents, { fontWeight: 'bold' }),
    ],
    [],
    [x('voidedNote'), voided.length],
  ]

  const issuedData = [
    [x('colNumber'), x('colIssuedAt'), x('colName'), x('colType'), x('colFees'), x('colProducts'), x('colTotal')].map(bold),
    ...issued.map(r => {
      const fees = toCents(r.total_fees)
      const products = toCents(r.total_products)
      return [
        r.receipt_number,
        dateCell(montrealDay(r.issued_at)),
        nameOnReceipt(r, studentNames),
        typeLabel(r.receipt_type),
        moneyCell(fees),
        moneyCell(products),
        moneyCell(fees + products),
      ]
    }),
    [
      bold(x('totalRow', { count: totals.count })),
      null,
      null,
      null,
      moneyCell(totals.feesCents, { fontWeight: 'bold' }),
      moneyCell(totals.productsCents, { fontWeight: 'bold' }),
      moneyCell(totals.totalCents, { fontWeight: 'bold' }),
    ],
  ]

  const voidedData = [
    [x('colNumber'), x('colIssuedAt'), x('colVoidedAt'), x('colName'), x('colType'), x('colVoidedValue')].map(bold),
    ...voided.map(r => [
      r.receipt_number,
      dateCell(montrealDay(r.issued_at)),
      r.voided_at ? dateCell(montrealDay(r.voided_at)) : null,
      nameOnReceipt(r, studentNames),
      typeLabel(r.receipt_type),
      moneyCell(toCents(r.total_fees) + toCents(r.total_products)),
    ]),
  ]

  return [
    { sheet: x('sheetSummary'), data: summaryData, columns: [{ width: 44 }, { width: 12 }, { width: 14 }, { width: 14 }, { width: 14 }] },
    {
      sheet: x('sheetIssued'),
      data: issuedData,
      columns: [{ width: 14 }, { width: 14 }, { width: 36 }, { width: 16 }, { width: 14 }, { width: 14 }, { width: 14 }],
      stickyRowsCount: 1,
    },
    {
      sheet: x('sheetVoided'),
      data: voidedData,
      columns: [{ width: 14 }, { width: 14 }, { width: 14 }, { width: 36 }, { width: 16 }, { width: 22 }],
      stickyRowsCount: 1,
    },
  ]
}
