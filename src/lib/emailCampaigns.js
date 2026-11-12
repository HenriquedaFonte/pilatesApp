// Story 4.4: registro de envios (tabela email_campaigns). Lógica pura, testável sem React.
import { LANGUAGES } from './emailRecipients'

export const HISTORY_PAGE_SIZE = 20

// Tipo gravado em email_campaigns / email_notifications conforme o tipo de envio.
export const campaignEmailType = kind =>
  kind === 'consent' ? 'consent_form' : kind === 'low_credits' ? 'low_credits' : 'custom'

const clean = text => {
  const value = (text || '').trim()
  return value ? value : null
}

/**
 * Linha nova de email_campaigns (só as colunas que a professora pode gravar;
 * created_by, status e contadores vêm do banco).
 * - custom: assunto e mensagem de cada língua (vazio → null) e quem assina.
 * - automáticos: só o assunto do histórico (`logSubject`) em pt.
 */
export const buildCampaignRow = ({ kind, content, senderName, logSubject, filter, total }) => {
  const emailType = campaignEmailType(kind)
  const row = {
    email_type: emailType,
    subject_pt: null,
    subject_en: null,
    subject_fr: null,
    message_pt: null,
    message_en: null,
    message_fr: null,
    sender_name: null,
    recipient_filter: filter || {},
    total
  }
  if (emailType === 'custom') {
    for (const lang of LANGUAGES) {
      row[`subject_${lang}`] = clean(content?.[lang]?.subject)
      row[`message_${lang}`] = clean(content?.[lang]?.message)
    }
    row.sender_name = clean(senderName)
  } else {
    row.subject_pt = clean(logSubject)
  }
  return row
}

/**
 * Filtro usado no envio, para o histórico (sem nome nem email de aluno).
 */
export const buildCampaignFilter = ({
  filterType,
  lowCreditsThreshold,
  selectedClass,
  className,
  includeInactive,
  excludedCount,
  templateId,
  resendOf
}) => {
  const filter = { group: filterType, include_inactive: !!includeInactive }
  if (filterType === 'low_credits') filter.threshold = lowCreditsThreshold
  if (filterType === 'class') {
    filter.class_id = selectedClass || null
    filter.class_name = className || null
  }
  if (filterType !== 'selected' && excludedCount > 0) filter.excluded = excludedCount
  if (templateId) filter.template = templateId
  if (resendOf) filter.resend_of = resendOf
  return filter
}

// Assunto mostrado no histórico: o da primeira língua preenchida (pt → en → fr).
export const campaignSubject = campaign =>
  LANGUAGES.map(lang => campaign?.[`subject_${lang}`]).find(s => s && s.trim()) || ''

// Texto da campanha no formato da tela ({ pt: { subject, message }, ... }).
export const campaignContent = campaign => {
  const content = {}
  for (const lang of LANGUAGES) {
    content[lang] = {
      subject: campaign?.[`subject_${lang}`] || '',
      message: campaign?.[`message_${lang}`] || ''
    }
  }
  return content
}

// Alunos (ids, sem repetir) cujo email falhou numa campanha.
export const failedStudentIds = rows => [
  ...new Set(
    (rows || []).filter(r => r.status === 'failed' && r.student_id).map(r => r.student_id)
  )
]

const TEMPLATE_BY_TYPE = { low_credits: 'lowCredits', consent_form: 'consentForm' }

/**
 * Como montar o reenvio para quem falhou:
 * - templateId: o modelo automático do tipo, ou "Aviso geral" com o texto
 *   gravado na campanha;
 * - selectedIds: só os alunos que falharam e ainda existem;
 * - includeInactive: liga se algum deles estiver inativo hoje (senão o filtro
 *   tiraria ele da lista).
 */
export const buildResend = (campaign, rows, students) => {
  const byId = new Map((students || []).map(s => [s.id, s]))
  const failedIds = failedStudentIds(rows)
  const selected = failedIds.filter(id => byId.has(id))
  return {
    templateId: TEMPLATE_BY_TYPE[campaign?.email_type] || 'blank',
    content: campaignContent(campaign),
    senderName: campaign?.sender_name || null,
    selectedIds: selected,
    missing: failedIds.length - selected.length,
    includeInactive: selected.some(id => byId.get(id).is_active === false)
  }
}

export const pageCount = (total, size = HISTORY_PAGE_SIZE) =>
  Math.max(1, Math.ceil((total || 0) / size))

// Intervalo do .range() do Supabase para a página (começa em 1).
export const pageRange = (page, size = HISTORY_PAGE_SIZE) => {
  const from = (Math.max(1, page) - 1) * size
  return [from, from + size - 1]
}
