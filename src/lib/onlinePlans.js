// Regras das aulas online (modalidade + pagamentos), sem Supabase (testável).
// As chamadas ao banco ficam em onlineService.js. Plano:
// docs/planos/2026-11-23-online-modalidades.md (decisões 4 a 9).
//
// Datas: sempre strings AAAA-MM-DD do dia de Montréal. A conta é feita com
// Date.UTC; nunca new Date('AAAA-MM-DD') local (em Montréal vira o dia anterior).

import { centsToNumber, isValidDateString, parseAmountToCents, todayMontreal } from './receipts'

export const ONLINE_PLANS = ['coached', 'recorded', 'dropin']
export const MONTHLY_PLANS = ['coached', 'recorded']
export const PAYMENT_KINDS = ['monthly', 'dropin']
// As mesmas 4 formas do pagamento presencial.
export const PAYMENT_METHODS = ['cash', 'interac', 'credit_card', 'other']
// Valores sugeridos (editáveis na tela), os da landing page; drop-in já com impostos.
export const SUGGESTED_PRICES = { coached: 58, recorded: 26, dropin: 16.1 } // drop-in = 16,10
// Valor sugerido como texto para o campo da tela ('58.00', '16.10'); plano desconhecido → ''.
export const suggestedAmount = plan =>
  SUGGESTED_PRICES[plan] === undefined ? '' : SUGGESTED_PRICES[plan].toFixed(2)
export const EXPIRING_DAYS = 5
// Mesmos limites do servidor (register_online_payment).
export const MAX_PERIOD_DAYS = 366
export const MIN_PAID_ON = '2020-01-01'
// Mensalidade que acabou há no máximo isso: a próxima começa no dia seguinte.
const CONTINUE_WITHIN_DAYS = 31
const DAY_MS = 24 * 60 * 60 * 1000

function parts(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return { y, m, d }
}

const fromUtcMs = ms => new Date(ms).toISOString().slice(0, 10)
const toUtcMs = dateStr => {
  const { y, m, d } = parts(dateStr)
  return Date.UTC(y, m - 1, d)
}

export function addDays(dateStr, n) {
  const { y, m, d } = parts(dateStr)
  return fromUtcMs(Date.UTC(y, m - 1, d + n))
}

// Soma meses mantendo o dia, "travado" no último dia do mês de destino
// (2027-01-31 + 1 mês → 2027-02-28).
export function addMonthsClamped(dateStr, n) {
  const { y, m, d } = parts(dateStr)
  const first = new Date(Date.UTC(y, m - 1 + n, 1))
  const ty = first.getUTCFullYear()
  const tm = first.getUTCMonth()
  const lastDay = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate()
  return fromUtcMs(Date.UTC(ty, tm, Math.min(d, lastDay)))
}

// Dias de `from` até `to` (negativo se `to` for antes).
export const daysBetween = (from, to) => Math.round((toUtcMs(to) - toUtcMs(from)) / DAY_MS)

const isValid = p => p && p.status !== 'void'
const validMonthly = payments =>
  (payments || []).filter(p => isValid(p) && p.kind === 'monthly' && p.period_start && p.period_end)
const validDropins = payments =>
  (payments || []).filter(p => isValid(p) && p.kind === 'dropin' && p.class_date)
const maxDate = dates => dates.reduce((max, d) => (max === null || d > max ? d : max), null)

// Período sugerido da próxima mensalidade (decisão 6): começa no dia seguinte
// ao fim da última mensalidade válida se esse fim for de no máximo 31 dias
// atrás; senão, hoje. Fim = início + 1 mês − 1 dia.
export function defaultMonthlyPeriod(payments, today = todayMontreal()) {
  const lastEnd = maxDate(validMonthly(payments).map(p => p.period_end))
  const periodStart =
    lastEnd && lastEnd >= addDays(today, -CONTINUE_WITHIN_DAYS) ? addDays(lastEnd, 1) : today
  return { periodStart, periodEnd: addDays(addMonthsClamped(periodStart, 1), -1) }
}

// Situação online do aluno (decisão 5). Pagamentos anulados não contam.
// state: 'none' | 'requested' | 'ended' | 'dropin' | 'paid' | 'expiring' | 'overdue' | 'unpaid'
// Para mensalidade: contam as válidas com period_start <= hoje, mais os
// períodos adiantados que continuam sem buraco (começam até o dia seguinte ao
// fim do pago); paidThrough é o maior period_end da cadeia.
export function onlineStatus({ membership, payments, today = todayMontreal() } = {}) {
  const started = validMonthly(payments).filter(p => p.period_start <= today)
  let paidThrough = maxDate(started.map(p => p.period_end))
  // Pagamento adiantado: períodos futuros que começam até o dia seguinte ao
  // fim do pago continuam a cadeia (renovar antes de vencer não deixa a
  // situação em "Vence em N dias").
  if (paidThrough) {
    const future = validMonthly(payments).filter(p => p.period_start > today)
    let extended = true
    while (extended) {
      extended = false
      for (const p of future) {
        if (p.period_start <= addDays(paidThrough, 1) && p.period_end > paidThrough) {
          paidThrough = p.period_end
          extended = true
        }
      }
    }
  }
  const dropins = validDropins(payments)
  const month = today.slice(0, 7)

  const result = {
    state: 'none',
    plan: membership?.plan ?? null,
    paidThrough,
    daysLeft: null,
    overdueSince: null,
    lastDropin: maxDate(dropins.map(p => p.class_date)),
    dropinsThisMonth: dropins.filter(p => p.class_date.slice(0, 7) === month).length,
  }

  if (paidThrough) {
    if (paidThrough >= today) result.daysLeft = daysBetween(today, paidThrough)
    else result.overdueSince = addDays(paidThrough, 1)
  }

  if (!membership) return result
  if (membership.status === 'requested' || membership.status === 'ended') {
    return { ...result, state: membership.status }
  }
  if (membership.status !== 'active') return result
  if (membership.plan === 'dropin') return { ...result, state: 'dropin' }

  if (!paidThrough) return { ...result, state: 'unpaid' }
  if (paidThrough < today) return { ...result, state: 'overdue' }
  return { ...result, state: result.daysLeft <= EXPIRING_DAYS ? 'expiring' : 'paid' }
}

// Aluno "só online" (decisão 9): modalidade ativa, 0 créditos presenciais e
// nenhuma turma no estúdio.
export function isOnlineOnly({ membership, totalCredits, hasStudioClasses } = {}) {
  return (
    membership?.status === 'active' &&
    (Number(totalCredits) || 0) === 0 &&
    !hasStudioClasses
  )
}

const trim = v => (v === null || v === undefined ? '' : String(v).trim())

// Formulário do pagamento:
// { studentId, kind, plan, periodStart, periodEnd, classDate, amount, paymentMethod, paidOn }
// Mesmas regras do servidor. Devolve { ok, errors } com errors por campo
// (chaves i18n online.errors.*).
export function validatePaymentForm(form = {}, today = todayMontreal()) {
  const errors = {}
  const { kind, plan, periodStart, periodEnd, classDate, amount, paymentMethod, paidOn } = form

  if (!PAYMENT_KINDS.includes(kind)) {
    errors.kind = 'online.errors.invalid_kind'
  } else if (kind === 'monthly') {
    if (!MONTHLY_PLANS.includes(plan)) errors.plan = 'online.errors.invalid_plan'
    const startOk = isValidDateString(periodStart)
    const endOk = isValidDateString(periodEnd)
    if (!startOk) errors.periodStart = 'online.errors.invalid_date'
    if (!endOk) errors.periodEnd = 'online.errors.invalid_date'
    if (
      startOk &&
      endOk &&
      (periodEnd < periodStart || periodEnd > addDays(periodStart, MAX_PERIOD_DAYS))
    ) {
      errors.periodEnd = 'online.errors.invalid_period'
    }
  } else if (!isValidDateString(classDate)) {
    errors.classDate = 'online.errors.invalid_date'
  }

  if (!isValidDateString(paidOn) || paidOn > today || paidOn < MIN_PAID_ON) {
    errors.paidOn = 'online.errors.invalid_date'
  }
  // parseAmountToCents já recusa negativo, mais de 2 casas e >= 100000.
  if (parseAmountToCents(trim(amount)) === null) errors.amount = 'online.errors.invalid_amount'
  if (!PAYMENT_METHODS.includes(paymentMethod)) errors.paymentMethod = 'online.errors.invalid_method'

  return { ok: Object.keys(errors).length === 0, errors }
}

// Formulário → parâmetros da RPC register_online_payment. Campos que o tipo
// não usa vão null. Valor inválido → erro (nunca vira 0 em silêncio).
export function paymentRpcParams(form = {}) {
  const cents = parseAmountToCents(trim(form.amount))
  if (cents === null) throw new Error('online_invalid_amount')
  const monthly = form.kind === 'monthly'
  return {
    p_student_id: form.studentId,
    p_kind: form.kind,
    p_plan: monthly ? form.plan : null,
    p_period_start: monthly ? form.periodStart : null,
    p_period_end: monthly ? form.periodEnd : null,
    p_class_date: monthly ? null : form.classDate,
    p_amount: centsToNumber(cents),
    p_payment_method: form.paymentMethod,
    p_paid_on: form.paidOn,
  }
}

// Códigos de erro das RPCs (RAISE EXCEPTION 'online_<código>') → chave i18n.
// Só códigos conhecidos; qualquer outra mensagem (rede, nome de tabela,
// texto interno do Postgres) vira online.errors.generic.
const ERROR_CODES = [
  'not_allowed',
  'invalid_student',
  'invalid_plan',
  'invalid_status',
  'invalid_kind',
  'plan_exists',
  'invalid_period',
  'period_overlap',
  'dropin_duplicate',
  'invalid_date',
  'invalid_amount',
  'invalid_method',
  'reason_required',
  'payment_not_found',
  'already_void',
]
const ERROR_RE = new RegExp(`\\bonline_(${ERROR_CODES.join('|')})\\b`)

export function onlineErrorKey(err) {
  const msg = String(err?.message ?? err ?? '')
  const match = ERROR_RE.exec(msg)
  return match ? `online.errors.${match[1]}` : 'online.errors.generic'
}
