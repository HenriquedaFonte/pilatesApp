// Termo das aulas, consentimento de saúde e ficha de saúde (lado do aluno).
// Plano: docs/planos/2026-11-28-perfil-e-consentimento-digital.md (PR C, passo 7).
// Banco: migrations 20261128000000 (tabelas e RPCs) e 20261128010000 (retirada).
//
// Tudo com a sessão de quem está logado (chave anon + JWT): a RLS deixa o aluno
// ler só os próprios aceites e a própria ficha. Aceites só pelas RPCs; a ficha
// só é gravada com consentimento de saúde ativo (senão a RLS recusa, 42501).
// Erros sobem como vieram; a tela traduz com consentErrorKey.
// Dados de saúde nunca vão para console/log aqui.

import { supabase } from './supabase'
import { todayMontreal } from './receipts'
import { montrealDateTimeLabel } from './receiptReport'

export const CONSENT_KINDS = ['class_policies', 'health_data']
export const CONSENT_LANGUAGES = ['pt', 'en', 'fr']
export const HEALTH_CONDITIONS = [
  'cardiac_hypertension',
  'respiratory',
  'digestive',
  'back_neck_shoulder',
  'hip_knee_foot',
  'frequent_headache',
]
export const HEALTH_QUALITY_OPTIONS = ['excellent', 'good', 'fair', 'poor']
export const HEALTH_TEXT_FIELDS = [
  'occupation',
  'emergency_contact_name',
  'emergency_contact_phone',
  'main_goal',
  'conditions_details',
  'medications',
  'current_treatment',
  'surgeries',
  'physical_activities',
]
export const TYPED_NAME_MIN = 2
export const TYPED_NAME_MAX = 200
export const PREGNANCY_WEEKS_MIN = 1
export const PREGNANCY_WEEKS_MAX = 42

// ---- Regras puras -----------------------------------------------------------

// Mesmo corte do servidor: btrim(nome, E' \t\r\n').
const trimLikeServer = v => String(v ?? '').replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, '')
// char_length do Postgres conta caracteres (code points), não unidades UTF-16.
const charLength = s => [...s].length

// Nome digitado no aceite. required = true para class_policies (o servidor
// recusa vazio); false para health_data (vazio vira null). Devolve
// { valid, name } com name aparado ou null.
export function validateTypedName(value, { required = true } = {}) {
  const name = trimLikeServer(value)
  if (name === '') return { valid: !required, name: null }
  const len = charLength(name)
  return { valid: len >= TYPED_NAME_MIN && len <= TYPED_NAME_MAX, name }
}

// "AAAA-MM-DD HH:mm" na hora de Montréal (aceite, retirada). Inválido → ''.
export function formatAcceptance(timestamp) {
  if (timestamp === null || timestamp === undefined || timestamp === '') return ''
  const d = timestamp instanceof Date ? timestamp : new Date(timestamp)
  if (Number.isNaN(d.getTime())) return ''
  return montrealDateTimeLabel(d)
}

const acceptanceKind = a => a?.kind ?? a?.consent_versions?.kind ?? null

// Estado do consentimento de saúde de um aluno:
//   'active'               há aceite health_data não retirado;
//   'retained'             existe ficha e nenhum aceite health_data ativo
//                          (ficha congelada: só leitura);
//   'withdrawn_no_profile' houve aceite health_data, todos retirados, sem ficha;
//   'none'                 nunca consentiu e não há ficha.
// acceptances: linhas com kind (ou consent_versions.kind) e withdrawn_at.
export function healthConsentState(acceptances, hasProfile) {
  const health = (acceptances || []).filter(a => acceptanceKind(a) === 'health_data')
  if (health.some(a => !a.withdrawn_at)) return 'active'
  if (hasProfile) return 'retained'
  if (health.length > 0) return 'withdrawn_no_profile'
  return 'none'
}

const hasText = v => typeof v === 'string' && v.trim() !== ''

// Chips de alerta para a professora adaptar a aula. Devolve
// [{ type, key, params }] com a chave i18n pronta para t(key, params).
export function healthAlerts(profile) {
  if (!profile) return []
  const alerts = []
  if (profile.pregnant === true) {
    const date = profile.pregnancy_reported_on || ''
    if (Number.isInteger(profile.pregnancy_weeks)) {
      alerts.push({
        type: 'pregnant',
        key: 'healthProfile.alerts.pregnantWeeks',
        params: { weeks: profile.pregnancy_weeks, date },
      })
    } else {
      alerts.push({ type: 'pregnant', key: 'healthProfile.alerts.pregnant', params: { date } })
    }
  }
  if (Array.isArray(profile.conditions) && profile.conditions.includes('cardiac_hypertension')) {
    alerts.push({ type: 'cardiac', key: 'healthProfile.alerts.cardiac', params: {} })
  }
  if (hasText(profile.surgeries)) {
    alerts.push({ type: 'surgeries', key: 'healthProfile.alerts.surgeries', params: {} })
  }
  return alerts
}

const blankToNull = v => {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

function normalizeWeeks(v) {
  if (v === null || v === undefined || String(v).trim() === '') return null
  const n = Number(String(v).trim())
  if (!Number.isInteger(n) || n < PREGNANCY_WEEKS_MIN || n > PREGNANCY_WEEKS_MAX) {
    throw new Error('consent_invalid_weeks')
  }
  return n
}

function normalizePregnant(v) {
  if (v === true || v === 'true') return true
  if (v === false || v === 'false') return false
  return null
}

// Linha a gravar na ficha (sem student_id). Campos vazios → null; só as
// condições e as 4 opções de sono/dieta conhecidas. Semanas só se gestante.
// pregnancy_reported_on = hoje em Montréal quando pregnant ou pregnancy_weeks
// mudam em relação à ficha anterior (previous = null para ficha nova); senão
// fica a data que já estava. Semanas inválidas → Error('consent_invalid_weeks').
export function healthProfilePayload(data = {}, previous = null, today = todayMontreal()) {
  const payload = {}
  for (const field of HEALTH_TEXT_FIELDS) payload[field] = blankToNull(data[field])

  const conditions = Array.isArray(data.conditions) ? data.conditions : []
  payload.conditions = HEALTH_CONDITIONS.filter(c => conditions.includes(c))

  payload.sleep_quality = HEALTH_QUALITY_OPTIONS.includes(data.sleep_quality) ? data.sleep_quality : null
  payload.diet_quality = HEALTH_QUALITY_OPTIONS.includes(data.diet_quality) ? data.diet_quality : null

  payload.pregnant = normalizePregnant(data.pregnant)
  payload.pregnancy_weeks = payload.pregnant === true ? normalizeWeeks(data.pregnancy_weeks) : null

  const prevPregnant = previous ? (previous.pregnant ?? null) : null
  const prevWeeks = previous ? (previous.pregnancy_weeks ?? null) : null
  const changed = payload.pregnant !== prevPregnant || payload.pregnancy_weeks !== prevWeeks
  payload.pregnancy_reported_on = changed ? today : (previous?.pregnancy_reported_on ?? null)
  return payload
}

// ---- Erros ------------------------------------------------------------------

const ERROR_CODES = [
  'not_allowed',
  'invalid_language',
  'version_not_found',
  'version_outdated',
  'invalid_name',
  'invalid_student',
  'invalid_date',
  'already_accepted',
  'immutable',
  'version_locked',
  'invalid_reason',
  'invalid_weeks',
]
const ERROR_RE = new RegExp(`\\bconsent_(${ERROR_CODES.join('|')})\\b`)

// Código consent_* (mensagem da RPC ou da validação local) → chave i18n
// consent.errors.<código sem o prefixo>; qualquer outro erro → consent.errors.generic.
export function consentErrorKey(err) {
  const msg = String(err?.message ?? err ?? '')
  const match = ERROR_RE.exec(msg)
  return match ? `consent.errors.${match[1]}` : 'consent.errors.generic'
}

// ---- Chamadas ao Supabase ---------------------------------------------------

// Versões atuais ainda sem aceite ativo do usuário logado:
// [{ kind, version_id, version }]. Sem versão publicada → [].
export async function fetchMyPendingConsents() {
  const { data, error } = await supabase.rpc('my_pending_consents')
  if (error) throw error
  return data || []
}

const VERSION_COLUMNS =
  'id, kind, version, title_pt, title_en, title_fr, body_pt, body_en, body_fr, published_at'

// Versão atual (maior version) de cada tipo: { class_policies, health_data },
// cada uma a linha completa ou null se ainda não há versão publicada.
export async function fetchCurrentVersions() {
  const { data, error } = await supabase
    .from('consent_versions')
    .select(VERSION_COLUMNS)
    .order('kind', { ascending: true })
    .order('version', { ascending: false })
  if (error) throw error
  const current = { class_policies: null, health_data: null }
  for (const row of data || []) {
    if (row.kind in current && current[row.kind] === null) current[row.kind] = row
  }
  return current
}

// Aceite digital da versão atual. typedName obrigatório para class_policies
// (o servidor valida). Devolve o id do aceite (o existente, se já aceitou).
export async function acceptConsent(versionId, language, typedName) {
  const { data, error } = await supabase.rpc('accept_consent', {
    p_version_id: versionId,
    p_language: language,
    p_typed_name: validateTypedName(typedName, { required: false }).name,
  })
  if (error) throw error
  return data
}

// Aceites do aluno (inclusive retirados), do mais recente para o mais antigo,
// com o texto da versão para "Ver texto". studentId obrigatório: a RLS deixa a
// professora ver todos, então o filtro aqui é o que limita ao aluno.
// IP e navegador não são lidos (só no detalhe da professora, PR D).
// Cada linha ganha kind e version no nível de cima.
export async function fetchMyAcceptances(studentId) {
  if (!studentId) throw new Error('consent_invalid_student')
  const { data, error } = await supabase
    .from('consent_acceptances')
    .select(
      `id, student_id, consent_version_id, method, language, typed_name, profile_name, guardian_name, signed_on, accepted_at, withdrawn_at, withdrawn_by, recorded_by, consent_versions(${VERSION_COLUMNS})`
    )
    .eq('student_id', studentId)
    .order('accepted_at', { ascending: false })
    .order('id', { ascending: true })
  if (error) throw error
  return (data || []).map(row => ({
    ...row,
    kind: row.consent_versions?.kind ?? null,
    version: row.consent_versions?.version ?? null,
  }))
}

// Ficha de saúde do aluno ou null. Para a professora, ficha congelada
// (consentimento retirado) também volta null: a RLS só deixa ler com
// consentimento ativo.
export async function fetchHealthProfile(studentId) {
  if (!studentId) throw new Error('consent_invalid_student')
  const { data, error } = await supabase
    .from('student_health_profiles')
    .select('*')
    .eq('student_id', studentId)
    .maybeSingle()
  if (error) throw error
  return data
}

// Só diz se a ficha existe (lê apenas student_id, sem baixar dado de saúde).
export async function healthProfileExists(studentId) {
  if (!studentId) throw new Error('consent_invalid_student')
  const { data, error } = await supabase
    .from('student_health_profiles')
    .select('student_id')
    .eq('student_id', studentId)
    .maybeSingle()
  if (error) throw error
  return !!data
}

// Grava (cria ou atualiza) a ficha. previous = a ficha como estava (null se
// nova); se não for passado, é lido antes, para a data da gravidez não andar
// sozinha a cada gravação. Sem consentimento de saúde ativo a RLS recusa (42501).
// Devolve a ficha gravada.
export async function saveHealthProfile(studentId, data, previous) {
  if (!studentId) throw new Error('consent_invalid_student')
  const before = previous === undefined ? await fetchHealthProfile(studentId) : previous
  const payload = { student_id: studentId, ...healthProfilePayload(data, before) }
  const { data: saved, error } = await supabase
    .from('student_health_profiles')
    .upsert(payload, { onConflict: 'student_id' })
    .select('*')
    .single()
  if (error) throw error
  return saved
}

// ---- Lado da professora (PR D, passo 12) ------------------------------------
// Todas as RPCs abaixo recusam quem não é staff (consent_not_allowed).

export const RETAINED_READ_REASONS = ['insurance', 'legal', 'student_request']

// Última retirada do consentimento de saúde (para "retirado em …") ou null.
export function lastHealthWithdrawal(acceptances) {
  const dates = (acceptances || [])
    .filter(a => acceptanceKind(a) === 'health_data' && a.withdrawn_at)
    .map(a => a.withdrawn_at)
    .sort()
  return dates.length ? dates[dates.length - 1] : null
}

// Aceite health_data ativo mais antigo (para "ativo desde …") ou null.
export function activeHealthSince(acceptances) {
  const dates = (acceptances || [])
    .filter(a => acceptanceKind(a) === 'health_data' && !a.withdrawn_at)
    .map(a => a.accepted_at)
    .filter(Boolean)
    .sort()
  return dates.length ? dates[0] : null
}

// Status do termo das aulas por aluno: [{ student_id, policies_status
// ('current' | 'outdated' | 'none'), health_consent, health_profile }].
// Todos os alunos, inclusive arquivados. Sem versão publicada, todos vêm 'current'.
export async function fetchConsentOverview() {
  const { data, error } = await supabase.rpc('staff_consent_overview')
  if (error) throw error
  return data || []
}

// Aceites do aluno com IP e navegador (só para o detalhe da professora).
export async function fetchStaffAcceptances(studentId) {
  if (!studentId) throw new Error('consent_invalid_student')
  const { data, error } = await supabase
    .from('consent_acceptances')
    .select(
      `id, student_id, consent_version_id, method, language, typed_name, profile_name, guardian_name, signed_on, accepted_at, ip, user_agent, withdrawn_at, withdrawn_by, recorded_by, consent_versions(${VERSION_COLUMNS})`
    )
    .eq('student_id', studentId)
    .order('accepted_at', { ascending: false })
    .order('id', { ascending: true })
  if (error) throw error
  return (data || []).map(row => ({
    ...row,
    kind: row.consent_versions?.kind ?? null,
    version: row.consent_versions?.version ?? null,
  }))
}

// Termo assinado em papel. signedOn 'AAAA-MM-DD'; guardianName opcional.
// Devolve o id do aceite criado.
export async function registerPaperConsent({ studentId, versionId, signedOn, signerName, guardianName }) {
  if (!studentId) throw new Error('consent_invalid_student')
  const signer = validateTypedName(signerName, { required: true })
  const guardian = validateTypedName(guardianName, { required: false })
  if (!signer.valid || !guardian.valid) throw new Error('consent_invalid_name')
  const { data, error } = await supabase.rpc('register_paper_consent', {
    p_student_id: studentId,
    p_version_id: versionId,
    p_signed_on: signedOn || null,
    p_signer_name: signer.name,
    p_guardian_name: guardian.name,
  })
  if (error) throw error
  return data
}

// A professora registra que o aluno retirou o consentimento de saúde.
// A ficha NÃO é apagada: fica congelada. Devolve quantos aceites foram marcados.
export async function withdrawHealthConsent(studentId) {
  if (!studentId) throw new Error('consent_invalid_student')
  const { data, error } = await supabase.rpc('withdraw_health_consent', { p_student_id: studentId })
  if (error) throw error
  return data ?? 0
}

// Leitura da ficha congelada, com motivo (cada chamada vai para o audit_log).
// Devolve a ficha ou null. Não guardar em cache: cada abertura é uma consulta.
export async function fetchRetainedHealthProfile(studentId, reason) {
  if (!studentId) throw new Error('consent_invalid_student')
  if (!RETAINED_READ_REASONS.includes(reason)) throw new Error('consent_invalid_reason')
  const { data, error } = await supabase.rpc('read_retained_health_profile', {
    p_student_id: studentId,
    p_reason: reason,
  })
  if (error) throw error
  return Array.isArray(data) ? (data[0] ?? null) : (data ?? null)
}

// Apaga a ficha (ativa ou congelada) pela RPC auditada. Nunca usar
// .from('student_health_profiles').delete(): o DELETE direto é revogado.
// Devolve quantas linhas apagou (0 não é erro).
export async function deleteHealthProfile(studentId) {
  if (!studentId) throw new Error('consent_invalid_student')
  const { data, error } = await supabase.rpc('delete_health_profile', { p_student_id: studentId })
  if (error) throw error
  return data ?? 0
}
