// Regras da Edge Function send-campaign (Story 4.5): quem pode chamar, o que
// o pedido aceita, como cada email é montado a partir da campanha gravada e o
// que fazer com a resposta do Resend.
// Módulo puro (sem Deno, sem rede): o index.ts faz banco e rede; os testes em
// src/tests/sendCampaignPolicy.test.js usam este arquivo.
//
//   - Só professora/admin (profiles.role in ('teacher','admin'), mesmo
//     critério de public.is_staff()) ou service_role (a própria função, ao
//     continuar o envio) chamam. Aluno: 403. Sem login: 401.
//   - O pedido só traz campaign_id (e, só para service_role, o número da
//     continuação). Destinatário, assunto, texto e anexo nunca vêm do
//     navegador: tudo sai da campanha e da fila gravadas no banco
//     (queue_email_campaign só põe alunos na fila) e do perfil do aluno.
//   - Texto da professora: escapado como no site (src/lib/customEmail.js),
//     quebras de linha viram <br>, {nome}/{creditos} trocados.

import { ALLOWED_ATTACHMENTS, STUDIO_FROM, escapeHtml, normalizeEmail } from '../send-email/policy.ts'
import {
  type CampaignLanguage,
  CONSENT_TEXTS,
  CUSTOM_TEXTS,
  LOW_CREDITS_TEXTS,
  PORTAL_LABELS,
  STUDIO_PHONE,
} from './texts.ts'

export { STUDIO_FROM, escapeHtml }

export const LANGUAGES: CampaignLanguage[] = ['pt', 'en', 'fr']
export const PORTAL_BASE_URL = 'https://josipilates.com'
export const CONSENT_ATTACHMENT = 'PilatesLessonsPolicies.pdf'

// ---- Ritmo e limites do envio ----
// Resend: limite padrão de 2 pedidos/segundo por conta. 600 ms entre emails
// dá ~1,7/s e deixa folga para o resto do site (contato, boas-vindas).
export const SEND_DELAY_MS = 600
// Depois de um 429 (limite do Resend), espera mais antes do próximo.
export const RATE_LIMIT_PAUSE_MS = 3000
// Linhas pegas de uma vez na fila.
export const CLAIM_BATCH = 10
// Supabase Edge Functions: limite de tempo de parede de 150 s (plano Free) ou
// 400 s (pagos) por chamada, contando o trabalho em segundo plano. A função
// para de pegar lotes novos depois de TIME_BUDGET_MS (o último lote leva no
// máximo ~CLAIM_BATCH × (SEND_DELAY_MS + 15 s de timeout do Resend) no pior
// caso, mas normalmente ~6 s) e chama a si mesma para continuar.
export const TIME_BUDGET_MS = 90_000
// Tempo da "vez" de enviar (email_campaign_acquire_worker). Maior que uma
// chamada inteira; se a chamada morrer, a vez vence sozinha.
export const LEASE_SECONDS = 180
// Linha "enviando" há mais que isso: a chamada que pegou morreu; pode pegar de novo.
export const STALE_CLAIM_SECONDS = 600
// Tentativas por aluno (erro de rede, 429, 5xx do Resend). Depois: falha.
export const MAX_ATTEMPTS = 3
// Quantas vezes a função chama a si mesma num envio (~ 90 s cada).
export const MAX_HOPS = 40
export const RESEND_TIMEOUT_MS = 15_000

// ---- Quem chama ----
export type Caller =
  | { kind: 'service' }
  | { kind: 'staff'; userId: string }
  | { kind: 'user'; userId: string }
  | { kind: 'anonymous' }

export type Refusal = { ok: false; status: number; error: string }

export function authorize(caller: Caller): { ok: true } | Refusal {
  if (caller.kind === 'service' || caller.kind === 'staff') return { ok: true }
  if (caller.kind === 'anonymous') return { ok: false, status: 401, error: 'Unauthorized' }
  return { ok: false, status: 403, error: 'Forbidden' }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Só campaign_id. "hop" (continuação) só conta quando quem chama é a própria
// função (service_role); da professora é sempre 0. O resto do corpo é ignorado.
export function parseRequest(
  body: unknown,
  caller: Caller,
): { ok: true; campaignId: string; hop: number } | Refusal {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, status: 400, error: 'Invalid request' }
  }
  // deno-lint-ignore no-explicit-any
  const b = body as Record<string, any>
  const id = typeof b.campaign_id === 'string' ? b.campaign_id.trim().toLowerCase() : ''
  if (!UUID_RE.test(id)) return { ok: false, status: 400, error: 'Invalid campaign_id' }
  let hop = 0
  if (caller.kind === 'service' && Number.isInteger(b.hop) && b.hop >= 0 && b.hop <= MAX_HOPS) {
    hop = b.hop
  }
  return { ok: true, campaignId: id, hop }
}

// ---- Campanha e destinatário (como vêm do banco) ----
export interface CampaignRow {
  id: string
  email_type: string
  subject_pt?: string | null
  subject_en?: string | null
  subject_fr?: string | null
  message_pt?: string | null
  message_en?: string | null
  message_fr?: string | null
  sender_name?: string | null
  status: string
  send_mode: string
}

// Uma linha de email_campaign_claim.
export interface ClaimedRecipient {
  student_id: string
  claim_token: string
  attempts: number
  email: string | null
  full_name: string | null
  preferred_language: string | null
  role: string | null
  deleted: boolean | null
  // deno-lint-ignore no-explicit-any
  credits: Record<string, any> | null
}

// Situação da campanha para começar/continuar um envio.
export function campaignGate(campaign: CampaignRow | null):
  | { ok: true }
  | { ok: false; status: number; error: string; campaignStatus?: string } {
  if (!campaign) return { ok: false, status: 404, error: 'Campaign not found' }
  if (campaign.send_mode !== 'server') return { ok: false, status: 409, error: 'Campaign is not queued' }
  if (campaign.status !== 'sending') {
    return { ok: false, status: 200, error: 'Campaign finished', campaignStatus: campaign.status }
  }
  return { ok: true }
}

// ---- Texto da professora (igual a src/lib/customEmail.js) ----
type Content = Record<CampaignLanguage, { subject: string; message: string }>

export const campaignContent = (c: CampaignRow): Content => ({
  pt: { subject: c.subject_pt || '', message: c.message_pt || '' },
  en: { subject: c.subject_en || '', message: c.message_en || '' },
  fr: { subject: c.subject_fr || '', message: c.message_fr || '' },
})

const isLanguageComplete = (content: Content, lang: CampaignLanguage) =>
  !!(content[lang].subject.trim() && content[lang].message.trim())

export const completeLanguages = (content: Content) => LANGUAGES.filter(l => isLanguageComplete(content, l))

export const resolveLanguage = (content: Content, lang: CampaignLanguage): CampaignLanguage | null =>
  isLanguageComplete(content, lang) ? lang : completeLanguages(content)[0] || null

export const studentLanguage = (value: string | null | undefined): CampaignLanguage =>
  LANGUAGES.includes(value as CampaignLanguage) ? (value as CampaignLanguage) : 'pt'

const VARIABLE_ALIASES: Record<string, 'nome' | 'creditos'> = {
  nome: 'nome',
  name: 'nome',
  nom: 'nome',
  prenom: 'nome',
  creditos: 'creditos',
  credits: 'creditos',
}
const VARIABLE_PATTERN = /\{([^{}\n]{1,30})\}/g
const normalizeKey = (key: string) =>
  key.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()

export const firstName = (fullName: string | null | undefined) => (fullName || '').trim().split(/\s+/)[0] || ''

export interface StudentVars {
  full_name: string
  credits: number
}

export const fillVariables = (text: string, student: StudentVars) =>
  (text || '').replace(VARIABLE_PATTERN, (match, key: string) => {
    const variable = VARIABLE_ALIASES[normalizeKey(key)]
    if (variable === 'nome') return firstName(student.full_name)
    if (variable === 'creditos') return String(student.credits)
    return match
  })

export const textToHtml = (text: string) => escapeHtml(text).replace(/\r?\n/g, '<br>')

export const EMAIL_HR = '<hr style="margin: 30px 0; border: none; border-top: 1px solid #e2e8f0;">'

// Botão "Acessar Portal do Aluno" antes da linha final (como o site faz em todo email).
export const addPortalCta = (html: string, language: CampaignLanguage, baseUrl = PORTAL_BASE_URL) => {
  if (!html.includes(EMAIL_HR)) return html
  const label = PORTAL_LABELS[language] || PORTAL_LABELS.pt
  const cta = `
          <div style="text-align: center; margin: 25px 0; padding: 18px; background-color: #f0fdf4; border-radius: 8px; border: 1px solid #bbf7d0;">
            <a href="${baseUrl}/login"
               style="background: linear-gradient(135deg, #01b48d 0%, #017a6b 100%); color: white; padding: 12px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 15px;">
              ${label}
            </a>
          </div>`
  return html.replace(EMAIL_HR, `${cta}\n          ${EMAIL_HR}`)
}

export interface BuiltEmail {
  language: CampaignLanguage
  subject: string
  html: string
  text: string
  attachments: string[]
}

// Mesmo HTML de buildCustomEmail (src/lib/customEmail.js), sem o botão do portal.
export function buildCustomHtml(
  student: StudentVars,
  content: Content,
  senderName: string,
  language: CampaignLanguage,
): { language: CampaignLanguage; subject: string; htmlContent: string; textContent: string } | null {
  const lang = resolveLanguage(content, language)
  if (!lang) return null
  const template = CUSTOM_TEXTS[lang]
  const name = (student.full_name || '').trim()
  const subject = `${fillVariables(content[lang].subject, student).trim()}`
  const message = fillVariables(content[lang].message, student).trim()
  const greeting = template.greeting(name)
  const signature = template.signature(senderName)

  const htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${escapeHtml(subject)}</title>
            <style>
              @media only screen and (max-width: 600px) {
                .email-container { padding: 10px !important; }
                .header { padding: 20px !important; }
                .header h1 { font-size: 24px !important; }
                .content { padding: 20px !important; }
                .message-box { padding: 20px !important; margin: 15px 0 !important; }
                h2 { font-size: 20px !important; }
                p { font-size: 16px !important; line-height: 1.5 !important; }
              }
            </style>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;" class="email-container">
            <div style="background: linear-gradient(135deg, #01b48d 0%, #017a6b 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;" class="header">
              <h1 style="color: white; margin: 0; font-size: 28px;">Josi Pilates</h1>
            </div>

            <div style="background: white; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 10px 10px;" class="content">
              <h2 style="color: #1e293b; margin-top: 0;">${escapeHtml(greeting)}</h2>

              <div style="background-color: #f1f5f9; padding: 25px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;" class="message-box">
                ${textToHtml(message)}
              </div>

              ${EMAIL_HR}

              <p style="color: #64748b; font-size: 14px; text-align: center;">
                <strong>${escapeHtml(signature)}</strong><br>
                <em>${escapeHtml(template.tagline)}</em>
              </p>
            </div>
          </body>
          </html>
        `

  const textContent = `
${greeting}

${message}

${signature}
${template.tagline}
        `

  return { language: lang, subject, htmlContent, textContent }
}

const lines = (items: string[], tag = 'li') => items.map(i => `<${tag}>${escapeHtml(i)}</${tag}>`).join('')

// Aviso de créditos baixos (mesmo layout do site, com o nome escapado).
export function buildLowCreditsEmail(name: string, credits: number, language: CampaignLanguage) {
  const t = LOW_CREDITS_TEXTS[language] || LOW_CREDITS_TEXTS.pt
  const contactItems = t.contactItems.map(i => i.replace('{phone}', STUDIO_PHONE))
  const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${escapeHtml(t.warning)}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #01b48d 0%, #017a6b 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">Josi Pilates</h1>
          <p style="color: #f0f0f0; margin: 5px 0 0 0; font-size: 16px;">Low Credits Alert</p>
        </div>

        <div style="background: white; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
          <h2 style="color: #2c3e50; margin-top: 0;">${escapeHtml(t.greeting(name))}</h2>

          <p>${escapeHtml(t.message)}</p>

          <div style="background-color: #fef3c7; border: 1px solid #f59e0b; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
            <h3 style="color: #92400e; margin: 0 0 10px 0;">${escapeHtml(t.warning)}</h3>
            <p style="margin: 0; font-size: 18px; font-weight: bold; color: #92400e;">
              ${escapeHtml(t.creditsText(credits))}
            </p>
          </div>

          <div style="background-color: #f1f5f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h4 style="color: #1e293b; margin-top: 0;">${escapeHtml(t.contactTitle)}</h4>
            <ul style="margin: 10px 0; padding-left: 20px;">
              ${lines(contactItems)}
            </ul>
          </div>

          <p>${escapeHtml(t.closing)}</p>

          ${EMAIL_HR}

          <p style="color: #64748b; font-size: 14px; text-align: center;">
            <strong>${escapeHtml(t.signature)}</strong><br>
            ${escapeHtml(t.teamName)}<br>
            <em>${escapeHtml(t.tagline)}</em>
          </p>
        </div>
      </body>
      </html>
    `
  const text = `
${t.greeting(name)}

${t.message}

${t.warning}
${t.creditsText(credits)}

${t.contactTitle}
${contactItems.map(i => `- ${i}`).join('\n')}

${t.closing}

${t.signature}
${t.teamName}
${t.tagline}
    `
  return { subject: t.subject, html: addPortalCta(html, language), text }
}

// Termo de consentimento (mesmo layout do site; o PDF vai anexado pelo index.ts).
export function buildConsentEmail(name: string, language: CampaignLanguage) {
  const t = CONSENT_TEXTS[language] || CONSENT_TEXTS.pt
  const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${escapeHtml(t.title)}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #01b48d 0%, #017a6b 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">Josi Pilates</h1>
          <p style="color: #f0f0f0; margin: 5px 0 0 0; font-size: 16px;">${escapeHtml(t.title)}</p>
        </div>

        <div style="background: white; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 10px 10px;">
          <h2 style="color: #1e293b; margin-top: 0;">${escapeHtml(t.greeting(name))}</h2>

          <p>${escapeHtml(t.introduction)}</p>

          <div style="background-color: #f1f5f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h4 style="color: #1e293b; margin-top: 0;">${escapeHtml(t.instructionsTitle)}</h4>
            <ol style="margin: 10px 0; padding-left: 20px;">
              ${lines(t.instructions)}
            </ol>
          </div>

          <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h4 style="color: #1e293b; margin-top: 0;">${escapeHtml(t.returnInstructions)}</h4>
            <ul style="margin: 10px 0; padding-left: 20px;">
              ${lines(t.returnMethods)}
            </ul>
          </div>

          <div style="background-color: #fef3c7; border: 1px solid #f59e0b; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h4 style="color: #92400e; margin-top: 0;">📋 ${escapeHtml(t.importance)}</h4>
            <ul style="margin: 10px 0; padding-left: 20px; color: #92400e;">
              ${lines(t.importantPoints)}
            </ul>
          </div>

          <p>${escapeHtml(t.questions)}</p>

          <p>${escapeHtml(t.closing)}</p>

          ${EMAIL_HR}

          <p style="color: #64748b; font-size: 14px; text-align: center;">
            <strong>${escapeHtml(t.signature)}</strong><br>
            ${escapeHtml(t.teamName)}
          </p>
        </div>
      </body>
      </html>
    `
  const text = `
${t.greeting(name)}

${t.introduction}

${t.instructionsTitle}
${t.instructions.map((instruction, index) => `${index + 1}. ${instruction}`).join('\n')}

${t.returnInstructions}
${t.returnMethods.map(m => `- ${m}`).join('\n')}

${t.importance}
${t.importantPoints.map(p => `- ${p}`).join('\n')}

${t.questions}

${t.closing}

${t.signature}
${t.teamName}
    `
  return { subject: t.subject, html: addPortalCta(html, language), text }
}

// Assunto gravado no histórico (email_notifications.subject), igual ao site:
// texto livre → assunto da primeira língua preenchida (sem trocar variáveis);
// modelos automáticos → o assunto gravado na campanha (pt).
export function logSubjectOf(campaign: CampaignRow): string {
  if (campaign.email_type === 'custom') {
    const content = campaignContent(campaign)
    const lang = completeLanguages(content)[0]
    return lang ? content[lang].subject.trim() : ''
  }
  if (campaign.subject_pt && campaign.subject_pt.trim()) return campaign.subject_pt.trim()
  if (campaign.email_type === 'low_credits') return LOW_CREDITS_TEXTS.pt.subject
  if (campaign.email_type === 'consent_form') return CONSENT_TEXTS.pt.subject
  return ''
}

const creditsTotal = (credits: ClaimedRecipient['credits']) => {
  const n = Number(credits?.total)
  return Number.isFinite(n) ? n : 0
}

export type Prepared =
  | { ok: true; to: string; email: BuiltEmail }
  | { ok: false; error: string }

/**
 * Email de um aluno da fila, montado só com dados do banco.
 * Recusa (vira "falhou" no histórico, sem chamar o Resend): quem não é aluno
 * ou está na lixeira, email inválido, tentativas demais, texto vazio, tipo
 * desconhecido.
 */
export function prepareEmail(campaign: CampaignRow, r: ClaimedRecipient): Prepared {
  if (r.role !== 'student' || r.deleted) return { ok: false, error: 'not_a_student' }
  const to = normalizeEmail(r.email)
  if (!to) return { ok: false, error: 'invalid_email' }
  if (r.attempts > MAX_ATTEMPTS) return { ok: false, error: 'too_many_attempts' }

  const language = studentLanguage(r.preferred_language)
  const fullName = (r.full_name || '').trim()
  const credits = creditsTotal(r.credits)

  if (campaign.email_type === 'custom') {
    const built = buildCustomHtml(
      { full_name: fullName, credits },
      campaignContent(campaign),
      campaign.sender_name || 'Professora',
      language,
    )
    if (!built || !built.subject) return { ok: false, error: 'empty_message' }
    return {
      ok: true,
      to,
      email: {
        language: built.language,
        subject: built.subject.replace(/[\r\n]+/g, ' '),
        html: addPortalCta(built.htmlContent, built.language),
        text: built.textContent,
        attachments: [],
      },
    }
  }
  if (campaign.email_type === 'low_credits') {
    const built = buildLowCreditsEmail(fullName, credits, language)
    return { ok: true, to, email: { language, ...built, attachments: [] } }
  }
  if (campaign.email_type === 'consent_form') {
    const built = buildConsentEmail(fullName, language)
    return { ok: true, to, email: { language, ...built, attachments: [CONSENT_ATTACHMENT] } }
  }
  return { ok: false, error: 'unknown_type' }
}

// O anexo só pode ser um da lista fixa da send-email.
export const attachmentSpec = (name: string) =>
  Object.prototype.hasOwnProperty.call(ALLOWED_ATTACHMENTS, name) ? ALLOWED_ATTACHMENTS[name] : null

// Chave de idempotência do Resend (vale 24 h): se a mesma linha for enviada de
// novo (a chamada morreu depois de mandar e antes de gravar), o Resend devolve
// o resultado do primeiro envio em vez de mandar outro email.
export const idempotencyKey = (campaignId: string, studentId: string) => `send-campaign/${campaignId}/${studentId}`

// ---- Resposta do Resend ----
export type Outcome = { outcome: 'sent' | 'failed' | 'retry'; error: string | null; providerId: string | null; pause: boolean }

const safeName = (value: unknown) =>
  typeof value === 'string' && /^[a-z_]{1,60}$/.test(value) ? value : 'error'

/**
 * status = null: erro de rede/timeout (não se sabe se saiu): tenta de novo com
 * a mesma chave de idempotência. 429/5xx: tenta de novo. 409: conflito da
 * chave de idempotência (provável envio anterior): falha, sem reenviar. Outro
 * 4xx: falha. Depois de MAX_ATTEMPTS, o que seria "tentar de novo" vira falha.
 * O erro gravado é só um código (resend_<status>:<nome>), nunca a mensagem do
 * Resend (pode ter o email do aluno).
 */
// deno-lint-ignore no-explicit-any
export function classifyResend(status: number | null, body: any, attempts: number): Outcome {
  const last = attempts >= MAX_ATTEMPTS
  if (status === null) {
    return last
      ? { outcome: 'failed', error: 'network_error', providerId: null, pause: false }
      : { outcome: 'retry', error: null, providerId: null, pause: false }
  }
  if (status >= 200 && status < 300) {
    const id = typeof body?.id === 'string' ? body.id.slice(0, 200) : null
    return { outcome: 'sent', error: null, providerId: id, pause: false }
  }
  const code = `resend_${status}:${safeName(body?.name)}`
  if (status === 429 || status >= 500) {
    return last
      ? { outcome: 'failed', error: code, providerId: null, pause: status === 429 }
      : { outcome: 'retry', error: null, providerId: null, pause: status === 429 }
  }
  return { outcome: 'failed', error: code, providerId: null, pause: false }
}

// Depois de uma chamada: continuar em outra chamada?
export function shouldContinue({ stoppedForTime, hop }: { stoppedForTime: boolean; hop: number }) {
  return stoppedForTime && hop < MAX_HOPS
}

export function outOfTime(startedAt: number, now: number, budget = TIME_BUDGET_MS) {
  return now - startedAt >= budget
}
