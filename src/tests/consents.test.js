// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const rpc = vi.fn()
let results = []
const builder = {
  select: vi.fn(() => builder),
  eq: vi.fn(() => builder),
  order: vi.fn(() => builder),
  upsert: vi.fn(() => builder),
  maybeSingle: vi.fn(() => Promise.resolve(results.shift())),
  single: vi.fn(() => Promise.resolve(results.shift())),
  then: (resolve, reject) => Promise.resolve(results.shift()).then(resolve, reject),
}
const from = vi.fn(() => builder)
vi.mock('@/lib/supabase', () => ({ supabase: { from, rpc } }))

const {
  consentErrorKey,
  formatAcceptance,
  healthAlerts,
  healthConsentState,
  healthProfilePayload,
  validateTypedName,
  fetchMyPendingConsents,
  fetchCurrentVersions,
  acceptConsent,
  fetchMyAcceptances,
  fetchHealthProfile,
  healthProfileExists,
  saveHealthProfile,
} = await import('@/lib/consents')

beforeEach(() => {
  vi.clearAllMocks()
  results = []
})

describe('validateTypedName', () => {
  it('apara como o servidor e aceita 2 a 200 caracteres', () => {
    expect(validateTypedName('  Ana Silva \n')).toEqual({ valid: true, name: 'Ana Silva' })
    expect(validateTypedName('A')).toEqual({ valid: false, name: 'A' })
    expect(validateTypedName('a'.repeat(200)).valid).toBe(true)
    expect(validateTypedName('a'.repeat(201)).valid).toBe(false)
  })

  it('conta caracteres, não unidades UTF-16', () => {
    expect(validateTypedName('😀😀').valid).toBe(true)
    expect(validateTypedName('😀'.repeat(200)).valid).toBe(true)
  })

  it('vazio: inválido se obrigatório, null se opcional', () => {
    expect(validateTypedName('   ')).toEqual({ valid: false, name: null })
    expect(validateTypedName(null)).toEqual({ valid: false, name: null })
    expect(validateTypedName('', { required: false })).toEqual({ valid: true, name: null })
    expect(validateTypedName('A', { required: false }).valid).toBe(false)
  })
})

describe('formatAcceptance', () => {
  it('mostra data e hora de Montréal', () => {
    // 2026-07-01 03:30 UTC = 2026-06-30 23:30 em Montréal (EDT)
    expect(formatAcceptance('2026-07-01T03:30:00Z')).toBe('2026-06-30 23:30')
    // inverno (EST, UTC-5)
    expect(formatAcceptance('2026-01-15T17:05:00Z')).toBe('2026-01-15 12:05')
    expect(formatAcceptance(new Date('2026-01-15T17:05:00Z'))).toBe('2026-01-15 12:05')
  })

  it('vazio ou inválido → ""', () => {
    expect(formatAcceptance(null)).toBe('')
    expect(formatAcceptance('')).toBe('')
    expect(formatAcceptance('não é data')).toBe('')
  })
})

describe('healthConsentState', () => {
  const health = (withdrawn_at = null) => ({ kind: 'health_data', withdrawn_at })
  const policies = { kind: 'class_policies', withdrawn_at: null }

  it('active quando há aceite health_data não retirado', () => {
    expect(healthConsentState([health()], false)).toBe('active')
    expect(healthConsentState([health('2026-01-01T00:00:00Z'), health()], true)).toBe('active')
  })

  it('retained quando existe ficha e nenhum aceite ativo', () => {
    expect(healthConsentState([health('2026-01-01T00:00:00Z')], true)).toBe('retained')
    expect(healthConsentState([policies], true)).toBe('retained')
  })

  it('withdrawn_no_profile e none', () => {
    expect(healthConsentState([health('2026-01-01T00:00:00Z')], false)).toBe('withdrawn_no_profile')
    expect(healthConsentState([policies], false)).toBe('none')
    expect(healthConsentState([], false)).toBe('none')
    expect(healthConsentState(null, false)).toBe('none')
  })

  it('aceita o kind dentro de consent_versions', () => {
    expect(
      healthConsentState([{ consent_versions: { kind: 'health_data' }, withdrawn_at: null }], false)
    ).toBe('active')
  })
})

describe('healthAlerts', () => {
  it('sem ficha ou sem nada a alertar → []', () => {
    expect(healthAlerts(null)).toEqual([])
    expect(healthAlerts({ pregnant: false, conditions: ['respiratory'], surgeries: '  ' })).toEqual([])
  })

  it('gestante com semanas e data, cardíaco e cirurgias', () => {
    const alerts = healthAlerts({
      pregnant: true,
      pregnancy_weeks: 20,
      pregnancy_reported_on: '2026-11-01',
      conditions: ['cardiac_hypertension', 'digestive'],
      surgeries: 'Joelho, 2019',
    })
    expect(alerts).toEqual([
      {
        type: 'pregnant',
        key: 'healthProfile.alerts.pregnantWeeks',
        params: { weeks: 20, date: '2026-11-01' },
      },
      { type: 'cardiac', key: 'healthProfile.alerts.cardiac', params: {} },
      { type: 'surgeries', key: 'healthProfile.alerts.surgeries', params: {} },
    ])
  })

  it('gestante sem semanas', () => {
    expect(healthAlerts({ pregnant: true, pregnancy_weeks: null, pregnancy_reported_on: '2026-11-01' })).toEqual([
      { type: 'pregnant', key: 'healthProfile.alerts.pregnant', params: { date: '2026-11-01' } },
    ])
  })
})

describe('healthProfilePayload', () => {
  const today = '2026-11-28'

  it('campos vazios viram null e só valores conhecidos passam', () => {
    const p = healthProfilePayload(
      {
        occupation: '  ',
        main_goal: ' Dor nas costas ',
        conditions: ['respiratory', 'x', 'cardiac_hypertension', 'respiratory'],
        sleep_quality: 'good',
        diet_quality: 'péssima',
        pregnant: '',
        pregnancy_weeks: '12',
        extra: 'ignorado',
        student_id: 'outro',
      },
      null,
      today
    )
    expect(p.occupation).toBeNull()
    expect(p.main_goal).toBe('Dor nas costas')
    expect(p.medications).toBeNull()
    expect(p.conditions).toEqual(['cardiac_hypertension', 'respiratory'])
    expect(p.sleep_quality).toBe('good')
    expect(p.diet_quality).toBeNull()
    expect(p.pregnant).toBeNull()
    expect(p.pregnancy_weeks).toBeNull()
    expect(p.pregnancy_reported_on).toBeNull()
    expect(p).not.toHaveProperty('extra')
    expect(p).not.toHaveProperty('student_id')
  })

  it('gravidez nova ou alterada grava a data de hoje', () => {
    expect(healthProfilePayload({ pregnant: true, pregnancy_weeks: '10' }, null, today)).toMatchObject({
      pregnant: true,
      pregnancy_weeks: 10,
      pregnancy_reported_on: today,
    })
    const prev = { pregnant: true, pregnancy_weeks: 10, pregnancy_reported_on: '2026-10-01' }
    expect(healthProfilePayload({ pregnant: true, pregnancy_weeks: 14 }, prev, today).pregnancy_reported_on).toBe(today)
    expect(healthProfilePayload({ pregnant: false }, prev, today).pregnancy_reported_on).toBe(today)
  })

  it('gravidez igual mantém a data anterior', () => {
    const prev = { pregnant: true, pregnancy_weeks: 10, pregnancy_reported_on: '2026-10-01' }
    expect(healthProfilePayload({ pregnant: true, pregnancy_weeks: '10', medications: 'x' }, prev, today)).toMatchObject({
      pregnancy_weeks: 10,
      pregnancy_reported_on: '2026-10-01',
    })
  })

  it('semanas só com gestante; fora de 1 a 42 → consent_invalid_weeks', () => {
    expect(healthProfilePayload({ pregnant: false, pregnancy_weeks: 50 }, null, today).pregnancy_weeks).toBeNull()
    expect(() => healthProfilePayload({ pregnant: true, pregnancy_weeks: 43 }, null, today)).toThrow('consent_invalid_weeks')
    expect(() => healthProfilePayload({ pregnant: true, pregnancy_weeks: '2.5' }, null, today)).toThrow('consent_invalid_weeks')
    expect(() => healthProfilePayload({ pregnant: true, pregnancy_weeks: 'abc' }, null, today)).toThrow('consent_invalid_weeks')
    expect(healthProfilePayload({ pregnant: true, pregnancy_weeks: '' }, null, today).pregnancy_weeks).toBeNull()
  })
})

describe('consentErrorKey', () => {
  it('traduz os códigos consent_* do servidor e locais', () => {
    expect(consentErrorKey({ message: 'consent_not_allowed' })).toBe('consent.errors.not_allowed')
    expect(consentErrorKey({ message: 'consent_invalid_name' })).toBe('consent.errors.invalid_name')
    expect(consentErrorKey({ message: 'consent_version_outdated' })).toBe('consent.errors.version_outdated')
    expect(consentErrorKey(new Error('consent_invalid_weeks'))).toBe('consent.errors.invalid_weeks')
    expect(consentErrorKey('consent_already_accepted')).toBe('consent.errors.already_accepted')
  })

  it('qualquer outro erro → generic', () => {
    expect(consentErrorKey({ message: 'new row violates row-level security policy' })).toBe('consent.errors.generic')
    expect(consentErrorKey({ message: 'consent_desconhecido' })).toBe('consent.errors.generic')
    expect(consentErrorKey(null)).toBe('consent.errors.generic')
  })
})

describe('chamadas ao Supabase', () => {
  it('fetchMyPendingConsents chama a RPC e devolve [] sem dados', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null })
    expect(await fetchMyPendingConsents()).toEqual([])
    expect(rpc).toHaveBeenCalledWith('my_pending_consents')

    const err = { message: 'falhou' }
    rpc.mockResolvedValueOnce({ data: null, error: err })
    await expect(fetchMyPendingConsents()).rejects.toBe(err)
  })

  it('fetchCurrentVersions fica com a maior versão de cada tipo', async () => {
    results.push({
      data: [
        { id: 'c2', kind: 'class_policies', version: 2 },
        { id: 'c1', kind: 'class_policies', version: 1 },
        { id: 'h1', kind: 'health_data', version: 1 },
      ],
      error: null,
    })
    const current = await fetchCurrentVersions()
    expect(current.class_policies.id).toBe('c2')
    expect(current.health_data.id).toBe('h1')
    expect(from).toHaveBeenCalledWith('consent_versions')
    expect(builder.order).toHaveBeenCalledWith('version', { ascending: false })

    results.push({ data: [], error: null })
    expect(await fetchCurrentVersions()).toEqual({ class_policies: null, health_data: null })
  })

  it('acceptConsent manda os parâmetros da RPC com o nome aparado', async () => {
    rpc.mockResolvedValueOnce({ data: 'acc-1', error: null })
    expect(await acceptConsent('v1', 'fr', '  Ana Silva ')).toBe('acc-1')
    expect(rpc).toHaveBeenCalledWith('accept_consent', {
      p_version_id: 'v1',
      p_language: 'fr',
      p_typed_name: 'Ana Silva',
    })

    rpc.mockResolvedValueOnce({ data: 'acc-2', error: null })
    await acceptConsent('v2', 'pt', '')
    expect(rpc).toHaveBeenLastCalledWith('accept_consent', {
      p_version_id: 'v2',
      p_language: 'pt',
      p_typed_name: null,
    })

    rpc.mockResolvedValueOnce({ data: null, error: { message: 'consent_invalid_name' } })
    await expect(acceptConsent('v1', 'pt', 'A')).rejects.toEqual({ message: 'consent_invalid_name' })
  })

  it('fetchMyAcceptances filtra pelo aluno, lê withdrawn_at, não lê IP e achata kind/version', async () => {
    results.push({
      data: [
        { id: 'a1', withdrawn_at: null, consent_versions: { kind: 'health_data', version: 1 } },
      ],
      error: null,
    })
    const rows = await fetchMyAcceptances('s1')
    expect(rows).toEqual([
      {
        id: 'a1',
        withdrawn_at: null,
        consent_versions: { kind: 'health_data', version: 1 },
        kind: 'health_data',
        version: 1,
      },
    ])
    expect(from).toHaveBeenCalledWith('consent_acceptances')
    expect(builder.eq).toHaveBeenCalledWith('student_id', 's1')
    const columns = builder.select.mock.calls[0][0]
    expect(columns).toContain('withdrawn_at')
    expect(columns).not.toMatch(/\bip\b/)
    expect(columns).not.toContain('user_agent')

    await expect(fetchMyAcceptances()).rejects.toThrow('consent_invalid_student')
  })

  it('healthProfileExists lê só student_id e recusa id vazio', async () => {
    results.push({ data: { student_id: 's1' }, error: null })
    await expect(healthProfileExists('s1')).resolves.toBe(true)
    expect(builder.select).toHaveBeenLastCalledWith('student_id')
    results.push({ data: null, error: null })
    await expect(healthProfileExists('s1')).resolves.toBe(false)
    await expect(healthProfileExists()).rejects.toThrow('consent_invalid_student')
  })

  it('fetchHealthProfile lê a ficha do aluno', async () => {
    results.push({ data: { student_id: 's1' }, error: null })
    expect(await fetchHealthProfile('s1')).toEqual({ student_id: 's1' })
    expect(from).toHaveBeenCalledWith('student_health_profiles')
    expect(builder.eq).toHaveBeenCalledWith('student_id', 's1')
    await expect(fetchHealthProfile('')).rejects.toThrow('consent_invalid_student')
  })

  it('saveHealthProfile faz upsert por student_id com o previous dado', async () => {
    results.push({ data: { student_id: 's1', medications: 'x' }, error: null })
    const saved = await saveHealthProfile('s1', { medications: ' x ', occupation: '' }, null)
    expect(saved).toEqual({ student_id: 's1', medications: 'x' })
    const [payload, options] = builder.upsert.mock.calls[0]
    expect(options).toEqual({ onConflict: 'student_id' })
    expect(payload).toMatchObject({ student_id: 's1', medications: 'x', occupation: null })
    expect(builder.maybeSingle).not.toHaveBeenCalled()
  })

  it('saveHealthProfile sem previous lê a ficha antes (data da gravidez não anda)', async () => {
    results.push({
      data: { student_id: 's1', pregnant: true, pregnancy_weeks: 10, pregnancy_reported_on: '2026-10-01' },
      error: null,
    })
    results.push({ data: { student_id: 's1' }, error: null })
    await saveHealthProfile('s1', { pregnant: true, pregnancy_weeks: 10 })
    expect(builder.maybeSingle).toHaveBeenCalledTimes(1)
    expect(builder.upsert.mock.calls[0][0].pregnancy_reported_on).toBe('2026-10-01')
  })

  it('saveHealthProfile repassa o erro da RLS e não grava com semanas inválidas', async () => {
    const err = { code: '42501', message: 'new row violates row-level security policy' }
    results.push({ data: null, error: err })
    await expect(saveHealthProfile('s1', {}, null)).rejects.toBe(err)

    await expect(saveHealthProfile('s1', { pregnant: true, pregnancy_weeks: 99 }, null)).rejects.toThrow(
      'consent_invalid_weeks'
    )
    expect(builder.upsert).toHaveBeenCalledTimes(1)
  })
})
