// Envio rápido de um modelo de email para UM aluno, a partir do card da lista
// de Alunos (menu ⋮). Usa o mesmo fluxo da tela E-mails: registra em
// email_campaigns → RPC queue_email_campaign → Edge Function send-campaign, e
// acompanha lendo a campanha. Assim o envio fica no Histórico de E-mails e o
// servidor escolhe a língua do aluno. Lógica pura (dependências injetadas),
// testável sem React e sem mock de módulo.
import { buildCampaignRow, buildCampaignFilter, campaignProgress } from './emailCampaigns'
import { templateContent } from './templateCards'

export const ZERO_CREDITS_TEMPLATE = 'zeroCreditsNotice'

// Só para quem está sem créditos (saldo negativo também conta) e não é aluno
// "só online" (mesma regra dos grupos da tela E-mails).
export const canSendZeroCreditsEmail = ({ totalBalance, onlineOnly }) =>
  totalBalance <= 0 && !onlineOnly

/**
 * Linha nova de email_campaigns para um envio de modelo a um aluno.
 * includeInactive = o aluno está inativo (só para o registro do histórico).
 */
export const buildQuickCampaignRow = ({ templateId, senderName, includeInactive }) => {
  const filter = {
    ...buildCampaignFilter({ filterType: 'selected', includeInactive, templateId }),
    source: 'student_card'
  }
  return buildCampaignRow({
    kind: 'custom',
    content: templateContent(templateId),
    senderName,
    filter,
    total: 1
  })
}

// Só o código do erro: nunca email, nome do aluno ou mensagem do servidor.
const errorCode = error => error?.code || error?.name || 'unknown'

/**
 * Manda o modelo `templateId` para `student` e espera até `waitMs` pelo resultado.
 * - db: cliente supabase; startCampaign: id => chama a send-campaign;
 *   sleep: ms => Promise.
 * Devolve:
 * - { status: 'error', step: 'campaign' } — nada foi registrado nem enviado;
 * - { status: 'error', step: 'queue' } — registro fechado como falha, nada enviado;
 * - { status: 'sent' | 'failed', campaignId } — o servidor terminou;
 * - { status: 'pending', campaignId } — ainda enviando (ver o Histórico).
 */
export const sendTemplateToStudent = async ({
  db,
  startCampaign,
  student,
  templateId,
  senderName,
  sleep,
  waitMs = 20000,
  pollMs = 2000
}) => {
  // 1. Registro do envio.
  const row = buildQuickCampaignRow({
    templateId,
    senderName,
    includeInactive: student?.is_active === false
  })
  const { data: created, error: createError } = await db
    .from('email_campaigns')
    .insert(row)
    .select('id')
    .single()
  if (createError || !created?.id) {
    console.error('Error creating email campaign:', errorCode(createError))
    return { status: 'error', step: 'campaign' }
  }
  const campaignId = created.id

  // 2. Fila (só professora, só uma vez por campanha).
  const { error: queueError } = await db.rpc('queue_email_campaign', {
    p_campaign_id: campaignId,
    p_student_ids: [student.id]
  })
  if (queueError) {
    console.error('Error queueing email campaign:', errorCode(queueError))
    // Nada foi enviado: o registro fica como falha.
    const { error: finishError } = await db.rpc('finish_email_campaign', { p_campaign_id: campaignId })
    if (finishError) console.error('Error finishing email campaign:', errorCode(finishError))
    return { status: 'error', step: 'queue' }
  }

  // 3. Dispara o envio no servidor (uma nova tentativa se falhar; se falhar de
  //    novo, a campanha continua na fila e o Histórico tem "Continuar envio").
  try {
    await startCampaign(campaignId)
  } catch (error) {
    console.error('Error starting email campaign:', errorCode(error))
    await sleep(pollMs)
    try {
      await startCampaign(campaignId)
    } catch (retryError) {
      console.error('Error starting email campaign (retry):', errorCode(retryError))
    }
  }

  // 4. Acompanha o resultado lendo a campanha.
  for (let waited = 0; waited < waitMs; waited += pollMs) {
    await sleep(pollMs)
    const { data, error } = await db
      .from('email_campaigns')
      .select('id, total, sent, failed, status')
      .eq('id', campaignId)
      .single()
    if (error || !data) {
      console.error('Error loading email campaign:', errorCode(error))
      continue
    }
    if (campaignProgress(data).finished) {
      return { status: (data.sent || 0) > 0 ? 'sent' : 'failed', campaignId }
    }
  }
  return { status: 'pending', campaignId }
}
