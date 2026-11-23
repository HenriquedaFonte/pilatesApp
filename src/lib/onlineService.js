// Chamadas ao Supabase das aulas online. Tudo com a sessão de quem está logado
// (chave anon + JWT): a RLS deixa o aluno ler só a própria modalidade e os
// próprios pagamentos, e a professora ler todos; escrita só pelas RPCs da
// migration 20261123000000_create_online_memberships.sql.
// Erros sobem como vieram; a tela traduz com onlineErrorKey (onlinePlans.js).

import { supabase } from './supabase'
import { paymentRpcParams } from './onlinePlans'

export const ONLINE_PAGE_SIZE = 1000

// Lê todas as linhas de uma consulta, de 1000 em 1000 (o limite da API).
// `build` monta a consulta (com uma ordem estável) a cada página.
async function fetchAllRows(build) {
  const rows = []
  for (let start = 0; ; start += ONLINE_PAGE_SIZE) {
    const { data, error } = await build().range(start, start + ONLINE_PAGE_SIZE - 1)
    if (error) throw error
    const page = data || []
    rows.push(...page)
    if (page.length < ONLINE_PAGE_SIZE) break
  }
  return rows
}

// Modalidade do aluno ou null se ele não tem nenhuma.
export async function fetchMembership(studentId) {
  const { data, error } = await supabase
    .from('online_memberships')
    .select('*')
    .eq('student_id', studentId)
    .maybeSingle()
  if (error) throw error
  return data
}

// Pagamentos do aluno (válidos e anulados), do mais recente para o mais antigo.
export async function fetchPayments(studentId) {
  return fetchAllRows(() =>
    supabase
      .from('online_payments')
      .select('*')
      .eq('student_id', studentId)
      .order('paid_on', { ascending: false })
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
  )
}

// Para a lista de alunos (professora): todas as modalidades + pagamentos
// válidos, só com as colunas que onlineStatus usa. Devolve
// { memberships, payments } (payments já com kind e status para onlineStatus).
export async function fetchOnlineOverview() {
  const [memberships, monthly, dropins] = await Promise.all([
    fetchAllRows(() =>
      supabase
        .from('online_memberships')
        .select('student_id, plan, status, requested_at, started_on, ended_on')
        .order('student_id', { ascending: true })
    ),
    fetchAllRows(() =>
      supabase
        .from('online_payments')
        .select('id, student_id, kind, status, plan, period_start, period_end')
        .eq('kind', 'monthly')
        .eq('status', 'valid')
        .order('id', { ascending: true })
    ),
    fetchAllRows(() =>
      supabase
        .from('online_payments')
        .select('id, student_id, kind, status, class_date')
        .eq('kind', 'dropin')
        .eq('status', 'valid')
        .order('id', { ascending: true })
    ),
  ])
  return { memberships, payments: [...monthly, ...dropins] }
}

// Aluno pede uma modalidade (fica 'requested' até a professora aprovar).
export async function requestOnlinePlan(plan) {
  const { error } = await supabase.rpc('request_online_plan', { p_plan: plan })
  if (error) throw error
}

// Professora: status 'active' (atribuir/aprovar/mudar) ou 'ended' (encerrar/recusar).
export async function setMembership(studentId, plan, status) {
  const { error } = await supabase.rpc('set_online_membership', {
    p_student_id: studentId,
    p_plan: plan,
    p_status: status,
  })
  if (error) throw error
}

// Professora registra um pagamento. form = { studentId, kind, plan, periodStart,
// periodEnd, classDate, amount, paymentMethod, paidOn }. Devolve o id gravado.
export async function registerPayment(form) {
  const { data, error } = await supabase.rpc('register_online_payment', paymentRpcParams(form))
  if (error) throw error
  return data
}

export async function voidPayment(paymentId, reason) {
  const { error } = await supabase.rpc('void_online_payment', {
    p_payment_id: paymentId,
    p_reason: reason,
  })
  if (error) throw error
}
