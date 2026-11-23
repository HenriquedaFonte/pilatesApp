// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  EXPIRING_DAYS,
  SUGGESTED_PRICES,
  addDays,
  addMonthsClamped,
  daysBetween,
  defaultMonthlyPeriod,
  isOnlineOnly,
  onlineErrorKey,
  onlineStatus,
  paymentRpcParams,
  suggestedAmount,
  validatePaymentForm,
} from '@/lib/onlinePlans'

const rpc = vi.fn()
let pages = []
const builder = {
  select: vi.fn(() => builder),
  eq: vi.fn(() => builder),
  order: vi.fn(() => builder),
  range: vi.fn(() => Promise.resolve(pages.shift() ?? { data: [], error: null })),
  maybeSingle: vi.fn(() => Promise.resolve(pages.shift())),
}
const from = vi.fn(() => builder)
vi.mock('@/lib/supabase', () => ({ supabase: { from, rpc } }))

const service = await import('@/lib/onlineService')

const TODAY = '2026-11-23'
const monthly = (start, end, extra = {}) => ({
  kind: 'monthly',
  plan: 'coached',
  period_start: start,
  period_end: end,
  status: 'valid',
  ...extra,
})
const dropin = (date, extra = {}) => ({ kind: 'dropin', class_date: date, status: 'valid', ...extra })
const active = plan => ({ plan, status: 'active' })

describe('datas (só UTC/strings)', () => {
  it('addDays atravessa mês, ano e bissexto', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29')
    expect(addDays('2026-11-23', -31)).toBe('2026-10-23')
  })

  it('addMonthsClamped trava no último dia do mês', () => {
    expect(addMonthsClamped('2027-01-15', 1)).toBe('2027-02-15')
    expect(addMonthsClamped('2027-01-31', 1)).toBe('2027-02-28')
    expect(addMonthsClamped('2028-01-31', 1)).toBe('2028-02-29')
    expect(addMonthsClamped('2026-12-01', 1)).toBe('2027-01-01')
    expect(addMonthsClamped('2026-03-31', 1)).toBe('2026-04-30')
  })

  it('daysBetween', () => {
    expect(daysBetween('2026-11-23', '2026-11-28')).toBe(5)
    expect(daysBetween('2026-11-23', '2026-11-23')).toBe(0)
    expect(daysBetween('2026-11-23', '2026-11-22')).toBe(-1)
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2) // troca de horário
  })
})

describe('defaultMonthlyPeriod (decisão 6)', () => {
  const period = (today, payments = []) => defaultMonthlyPeriod(payments, today)

  it('início hoje: fim = início + 1 mês − 1 dia', () => {
    expect(period('2027-01-15')).toEqual({ periodStart: '2027-01-15', periodEnd: '2027-02-14' })
    expect(period('2027-01-31')).toEqual({ periodStart: '2027-01-31', periodEnd: '2027-02-27' })
    expect(period('2028-01-30')).toEqual({ periodStart: '2028-01-30', periodEnd: '2028-02-28' })
    expect(period('2026-12-01')).toEqual({ periodStart: '2026-12-01', periodEnd: '2026-12-31' })
  })

  it('sem pagamento → hoje', () => {
    expect(period(TODAY).periodStart).toBe(TODAY)
  })

  it('fim há 40 dias → hoje', () => {
    expect(period(TODAY, [monthly('2026-09-15', addDays(TODAY, -40))]).periodStart).toBe(TODAY)
  })

  it('fim há 31 dias → dia seguinte a esse fim', () => {
    const end = addDays(TODAY, -31)
    expect(period(TODAY, [monthly('2026-09-23', end)]).periodStart).toBe(addDays(end, 1))
  })

  it('fim ontem → hoje', () => {
    expect(period(TODAY, [monthly('2026-10-23', '2026-11-22')])).toEqual({
      periodStart: TODAY,
      periodEnd: '2026-12-22',
    })
  })

  it('fim no futuro → dia seguinte (pagamento adiantado)', () => {
    expect(period(TODAY, [monthly('2026-11-15', '2026-12-14')])).toEqual({
      periodStart: '2026-12-15',
      periodEnd: '2027-01-14',
    })
  })

  it('usa o maior fim e ignora anulados e drop-ins', () => {
    const payments = [
      monthly('2026-10-15', '2026-11-14'),
      monthly('2026-11-15', '2026-12-14', { status: 'void' }),
      dropin('2026-12-20'),
    ]
    expect(period(TODAY, payments).periodStart).toBe('2026-11-15')
  })
})

describe('onlineStatus (decisão 5)', () => {
  const status = (membership, payments = [], today = TODAY) =>
    onlineStatus({ membership, payments, today })

  it('sem modalidade → none', () => {
    expect(status(null).state).toBe('none')
    expect(onlineStatus().state).toBe('none')
  })

  it('requested e ended', () => {
    expect(status({ plan: 'recorded', status: 'requested' })).toMatchObject({
      state: 'requested',
      plan: 'recorded',
    })
    expect(status({ plan: 'coached', status: 'ended' }, [monthly('2026-11-01', '2026-11-30')]).state).toBe(
      'ended'
    )
  })

  it('paid: mais de 5 dias', () => {
    const r = status(active('coached'), [monthly('2026-11-15', '2026-12-14')])
    expect(r).toMatchObject({ state: 'paid', plan: 'coached', paidThrough: '2026-12-14', daysLeft: 21 })
    expect(r.overdueSince).toBeNull()
  })

  it('expiring no limite de 5 dias (e 6 dias ainda é paid)', () => {
    const end5 = addDays(TODAY, EXPIRING_DAYS)
    expect(status(active('coached'), [monthly('2026-11-01', end5)])).toMatchObject({
      state: 'expiring',
      daysLeft: 5,
      paidThrough: end5,
    })
    expect(status(active('coached'), [monthly('2026-11-01', addDays(TODAY, 6))]).state).toBe('paid')
  })

  it('expiring no último dia pago (0 dias)', () => {
    expect(status(active('recorded'), [monthly('2026-10-24', TODAY)])).toMatchObject({
      state: 'expiring',
      daysLeft: 0,
    })
  })

  it('overdue com overdueSince = dia seguinte ao fim', () => {
    expect(status(active('coached'), [monthly('2026-10-23', '2026-11-22')])).toMatchObject({
      state: 'overdue',
      paidThrough: '2026-11-22',
      overdueSince: '2026-11-23',
      daysLeft: null,
    })
  })

  it('unpaid: mensal sem pagamento', () => {
    expect(status(active('coached'))).toMatchObject({ state: 'unpaid', paidThrough: null })
  })

  it('pagamento futuro (começa depois de hoje) é ignorado', () => {
    expect(status(active('coached'), [monthly('2026-12-01', '2026-12-31')]).state).toBe('unpaid')
    const payments = [monthly('2026-10-01', '2026-10-31'), monthly('2026-12-01', '2026-12-31')]
    expect(status(active('coached'), payments)).toMatchObject({
      state: 'overdue',
      overdueSince: '2026-11-01',
    })
  })

  it('pagamento adiantado continua a cadeia (sem buraco)', () => {
    const payments = [monthly('2026-11-01', '2026-11-25'), monthly('2026-11-26', '2026-12-25')]
    expect(status(active('coached'), payments)).toMatchObject({ state: 'paid', paidThrough: '2026-12-25' })
    const chain = [...payments, monthly('2026-12-26', '2027-01-25')]
    expect(status(active('coached'), chain).paidThrough).toBe('2027-01-25')
  })

  it('pagamento futuro com buraco não conta', () => {
    const payments = [monthly('2026-11-01', '2026-11-25'), monthly('2026-11-27', '2026-12-26')]
    expect(status(active('coached'), payments)).toMatchObject({ state: 'expiring', paidThrough: '2026-11-25' })
  })

  it('anulado é ignorado', () => {
    const payments = [
      monthly('2026-10-01', '2026-10-31'),
      monthly('2026-11-01', '2026-11-30', { status: 'void' }),
    ]
    expect(status(active('coached'), payments)).toMatchObject({
      state: 'overdue',
      paidThrough: '2026-10-31',
    })
  })

  it('usa o maior fim entre as mensalidades já começadas', () => {
    const payments = [monthly('2026-10-15', '2026-11-14'), monthly('2026-11-15', '2026-12-14')]
    expect(status(active('coached'), payments).paidThrough).toBe('2026-12-14')
  })

  it('dropin: última aula e contagem do mês (anulados fora)', () => {
    const payments = [
      dropin('2026-10-30'),
      dropin('2026-11-05'),
      dropin('2026-11-19'),
      dropin('2026-11-20', { status: 'void' }),
    ]
    expect(status(active('dropin'), payments)).toMatchObject({
      state: 'dropin',
      plan: 'dropin',
      lastDropin: '2026-11-19',
      dropinsThisMonth: 2,
    })
  })

  it('dropin sem aula paga', () => {
    expect(status(active('dropin'))).toMatchObject({
      state: 'dropin',
      lastDropin: null,
      dropinsThisMonth: 0,
    })
  })

  it('drop-ins não contam como mensalidade', () => {
    expect(status(active('coached'), [dropin('2026-11-20')]).state).toBe('unpaid')
  })
})

describe('isOnlineOnly (decisão 9)', () => {
  it('ativa + 0 créditos + sem turma → true', () => {
    expect(isOnlineOnly({ membership: active('coached'), totalCredits: 0, hasStudioClasses: false })).toBe(
      true
    )
  })
  it('com créditos → false', () => {
    expect(isOnlineOnly({ membership: active('coached'), totalCredits: 3, hasStudioClasses: false })).toBe(
      false
    )
  })
  it('com turma no estúdio → false', () => {
    expect(isOnlineOnly({ membership: active('dropin'), totalCredits: 0, hasStudioClasses: true })).toBe(
      false
    )
  })
  it('modalidade não ativa (ou nenhuma) → false', () => {
    const base = { totalCredits: 0, hasStudioClasses: false }
    expect(isOnlineOnly({ ...base, membership: { plan: 'coached', status: 'requested' } })).toBe(false)
    expect(isOnlineOnly({ ...base, membership: { plan: 'coached', status: 'ended' } })).toBe(false)
    expect(isOnlineOnly({ ...base, membership: null })).toBe(false)
  })
})

describe('validatePaymentForm', () => {
  const monthlyForm = {
    kind: 'monthly',
    plan: 'coached',
    periodStart: '2026-11-23',
    periodEnd: '2026-12-22',
    amount: '58',
    paymentMethod: 'interac',
    paidOn: TODAY,
  }
  const dropinForm = {
    kind: 'dropin',
    classDate: '2026-11-25',
    amount: '16,10',
    paymentMethod: 'cash',
    paidOn: TODAY,
  }
  const errorsOf = form => validatePaymentForm(form, TODAY).errors

  it('formulários válidos', () => {
    expect(validatePaymentForm(monthlyForm, TODAY)).toEqual({ ok: true, errors: {} })
    expect(validatePaymentForm(dropinForm, TODAY)).toEqual({ ok: true, errors: {} })
    expect(validatePaymentForm({ ...monthlyForm, amount: '0' }, TODAY).ok).toBe(true)
  })

  it('valor: vírgula ok; 3 casas, negativo, vazio e >= 100000 recusados', () => {
    expect(errorsOf({ ...monthlyForm, amount: '58,5' }).amount).toBeUndefined()
    expect(errorsOf({ ...monthlyForm, amount: ' 58.50 ' }).amount).toBeUndefined()
    for (const amount of ['16.105', '-5', '', null, '100000', 'abc']) {
      expect(errorsOf({ ...monthlyForm, amount }).amount).toBe('online.errors.invalid_amount')
    }
  })

  it('data do pagamento: futura, inválida e antes de 2020', () => {
    expect(errorsOf({ ...monthlyForm, paidOn: '2026-11-24' }).paidOn).toBe('online.errors.invalid_date')
    expect(errorsOf({ ...monthlyForm, paidOn: '2026-02-30' }).paidOn).toBe('online.errors.invalid_date')
    expect(errorsOf({ ...monthlyForm, paidOn: '2019-12-31' }).paidOn).toBe('online.errors.invalid_date')
    expect(errorsOf({ ...monthlyForm, paidOn: '' }).paidOn).toBe('online.errors.invalid_date')
  })

  it('período: fim < início e mais de 366 dias', () => {
    expect(errorsOf({ ...monthlyForm, periodEnd: '2026-11-22' }).periodEnd).toBe(
      'online.errors.invalid_period'
    )
    expect(errorsOf({ ...monthlyForm, periodEnd: '2027-11-25' }).periodEnd).toBe(
      'online.errors.invalid_period'
    )
    expect(errorsOf({ ...monthlyForm, periodEnd: '2027-11-24' }).periodEnd).toBeUndefined()
    expect(errorsOf({ ...monthlyForm, periodEnd: monthlyForm.periodStart }).periodEnd).toBeUndefined()
    expect(errorsOf({ ...monthlyForm, periodStart: '' }).periodStart).toBe('online.errors.invalid_date')
  })

  it('mensalidade só com plano mensal; drop-in exige a data da aula (futura ok)', () => {
    expect(errorsOf({ ...monthlyForm, plan: 'dropin' }).plan).toBe('online.errors.invalid_plan')
    expect(errorsOf({ ...dropinForm, classDate: '' }).classDate).toBe('online.errors.invalid_date')
    expect(errorsOf({ ...dropinForm, classDate: '2026-12-02' }).classDate).toBeUndefined()
  })

  it('tipo e forma de pagamento', () => {
    expect(errorsOf({ ...monthlyForm, kind: 'yearly' }).kind).toBe('online.errors.invalid_kind')
    expect(errorsOf({ ...monthlyForm, paymentMethod: '' }).paymentMethod).toBe(
      'online.errors.invalid_method'
    )
    expect(errorsOf({ ...monthlyForm, paymentMethod: 'paypal' }).paymentMethod).toBe(
      'online.errors.invalid_method'
    )
  })
})

describe('valores sugeridos', () => {
  it('58 / 26 / 16,10', () => {
    expect(SUGGESTED_PRICES).toEqual({ coached: 58, recorded: 26, dropin: 16.1 })
    expect(suggestedAmount('coached')).toBe('58.00')
    expect(suggestedAmount('dropin')).toBe('16.10')
    expect(suggestedAmount('nope')).toBe('')
  })
})

describe('paymentRpcParams', () => {
  it('mensalidade: class_date null e valor em número', () => {
    expect(
      paymentRpcParams({
        studentId: 's1',
        kind: 'monthly',
        plan: 'recorded',
        periodStart: '2026-11-23',
        periodEnd: '2026-12-22',
        classDate: '2026-11-25',
        amount: '26,5',
        paymentMethod: 'interac',
        paidOn: TODAY,
      })
    ).toEqual({
      p_student_id: 's1',
      p_kind: 'monthly',
      p_plan: 'recorded',
      p_period_start: '2026-11-23',
      p_period_end: '2026-12-22',
      p_class_date: null,
      p_amount: 26.5,
      p_payment_method: 'interac',
      p_paid_on: TODAY,
    })
  })

  it('drop-in: plano e período null; 16,10 → 16.1', () => {
    expect(
      paymentRpcParams({
        studentId: 's1',
        kind: 'dropin',
        plan: 'coached',
        periodStart: '2026-11-23',
        periodEnd: '2026-12-22',
        classDate: '2026-11-25',
        amount: '16,10',
        paymentMethod: 'cash',
        paidOn: TODAY,
      })
    ).toMatchObject({
      p_plan: null,
      p_period_start: null,
      p_period_end: null,
      p_class_date: '2026-11-25',
      p_amount: 16.1,
    })
  })

  it('valor inválido nunca vira 0', () => {
    expect(() => paymentRpcParams({ kind: 'dropin', amount: '' })).toThrow('online_invalid_amount')
    expect(() => paymentRpcParams({ kind: 'dropin', amount: '1.234' })).toThrow('online_invalid_amount')
  })
})

describe('onlineErrorKey', () => {
  it('mapeia os códigos do servidor', () => {
    const codes = [
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
    for (const code of codes) {
      expect(onlineErrorKey({ message: `online_${code}`, code: '22023' })).toBe(`online.errors.${code}`)
    }
    expect(onlineErrorKey(new Error('online_invalid_amount'))).toBe('online.errors.invalid_amount')
    expect(onlineErrorKey('online_period_overlap')).toBe('online.errors.period_overlap')
  })

  it('qualquer outra coisa → generic (sem vazar texto interno)', () => {
    expect(onlineErrorKey({ message: 'permission denied for table online_payments' })).toBe(
      'online.errors.generic'
    )
    expect(onlineErrorKey({ message: 'online payments are immutable (only voiding is allowed)' })).toBe(
      'online.errors.generic'
    )
    expect(onlineErrorKey({ message: 'online_unknown_code' })).toBe('online.errors.generic')
    expect(onlineErrorKey(new TypeError('Failed to fetch'))).toBe('online.errors.generic')
    expect(onlineErrorKey(null)).toBe('online.errors.generic')
    expect(onlineErrorKey(undefined)).toBe('online.errors.generic')
  })
})

describe('onlineService', () => {
  beforeEach(() => {
    pages = []
    rpc.mockReset()
    from.mockClear()
    for (const fn of Object.values(builder)) fn.mockClear()
  })

  it('fetchMembership: linha ou null; erro sobe', async () => {
    pages = [{ data: { plan: 'coached', status: 'active' }, error: null }]
    await expect(service.fetchMembership('s1')).resolves.toEqual({ plan: 'coached', status: 'active' })
    expect(from).toHaveBeenCalledWith('online_memberships')
    expect(builder.eq).toHaveBeenCalledWith('student_id', 's1')

    pages = [{ data: null, error: null }]
    await expect(service.fetchMembership('s2')).resolves.toBeNull()

    const err = { message: 'boom' }
    pages = [{ data: null, error: err }]
    await expect(service.fetchMembership('s3')).rejects.toBe(err)
  })

  it('fetchPayments: ordem paid_on desc, created_at desc e paginação', async () => {
    pages = [
      { data: Array.from({ length: service.ONLINE_PAGE_SIZE }, (_, i) => ({ id: `p${i}` })), error: null },
      { data: [{ id: 'last' }], error: null },
    ]
    const rows = await service.fetchPayments('s1')
    expect(rows).toHaveLength(service.ONLINE_PAGE_SIZE + 1)
    expect(from).toHaveBeenCalledWith('online_payments')
    expect(builder.order).toHaveBeenNthCalledWith(1, 'paid_on', { ascending: false })
    expect(builder.order).toHaveBeenNthCalledWith(2, 'created_at', { ascending: false })
    expect(builder.range).toHaveBeenNthCalledWith(1, 0, 999)
    expect(builder.range).toHaveBeenNthCalledWith(2, 1000, 1999)
  })

  it('fetchOnlineOverview: só pagamentos válidos, colunas mínimas', async () => {
    const overview = await service.fetchOnlineOverview()
    expect(overview).toEqual({ memberships: [], payments: [] })
    expect(builder.eq).toHaveBeenCalledWith('status', 'valid')
    expect(builder.eq).toHaveBeenCalledWith('kind', 'monthly')
    expect(builder.eq).toHaveBeenCalledWith('kind', 'dropin')
    for (const [cols] of builder.select.mock.calls) {
      expect(cols).not.toContain('void_reason')
      expect(cols).not.toContain('*')
    }
  })

  it('RPCs: parâmetros e erros sobem como vieram', async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    await service.requestOnlinePlan('recorded')
    expect(rpc).toHaveBeenLastCalledWith('request_online_plan', { p_plan: 'recorded' })

    await service.setMembership('s1', 'dropin', 'active')
    expect(rpc).toHaveBeenLastCalledWith('set_online_membership', {
      p_student_id: 's1',
      p_plan: 'dropin',
      p_status: 'active',
    })

    await service.voidPayment('p1', 'lançado em dobro')
    expect(rpc).toHaveBeenLastCalledWith('void_online_payment', {
      p_payment_id: 'p1',
      p_reason: 'lançado em dobro',
    })

    rpc.mockResolvedValue({ data: 'new-id', error: null })
    const form = {
      studentId: 's1',
      kind: 'dropin',
      classDate: '2026-11-25',
      amount: '16.10',
      paymentMethod: 'interac',
      paidOn: TODAY,
    }
    await expect(service.registerPayment(form)).resolves.toBe('new-id')
    expect(rpc).toHaveBeenLastCalledWith('register_online_payment', paymentRpcParams(form))

    const err = { message: 'online_period_overlap' }
    rpc.mockResolvedValue({ data: null, error: err })
    await expect(service.registerPayment(form)).rejects.toBe(err)
    await expect(service.setMembership('s1', 'coached', 'ended')).rejects.toBe(err)
  })

  it('registerPayment com valor inválido não chama o servidor', async () => {
    await expect(
      service.registerPayment({ studentId: 's1', kind: 'dropin', amount: 'x' })
    ).rejects.toThrow('online_invalid_amount')
    expect(rpc).not.toHaveBeenCalled()
  })
})
