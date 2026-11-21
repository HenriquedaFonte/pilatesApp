// Aviso ao aluno por email quando um recibo de seguro é emitido ou anulado
// (pedido de 2026-11-21; plano docs/planos/2026-11-21-recibo-email-aluno.md).
// Módulo puro (sem Deno, sem rede): o index.ts lê o recibo e o perfil do aluno
// com service_role e chama as funções daqui. Testes: src/tests/receiptNotice.test.js.
//
//   - Só professora/admin logada (caller 'staff'). service_role, aluno e sem
//     login: recusado (403 / 401).
//   - Corpo: { type: 'receipt_notice', receipt_id: uuid, event: 'issued' | 'voided' }.
//     Destinatário, assunto, HTML, anexos e Reply-To do corpo são ignorados.
//   - 'issued': o recibo tem de estar emitido (status 'issued') e ter sido
//     emitido há no máximo NOTICE_WINDOW_MS; 'voided': anulado (status 'void')
//     há no máximo NOTICE_WINDOW_MS. Fora disso: 409 (não avisa de novo de
//     recibo antigo). O index.ts ainda manda ao Resend uma Idempotency-Key por
//     recibo e evento: repetir em 24 h não manda outro email.
//   - Destinatário: profiles.email do aluno do recibo (lido no servidor). Sem
//     email válido ou perfil na lixeira (deleted_at): nada sai (kind 'skip').
//   - Texto fixo em pt/en/fr pela preferred_language do aluno (outra → pt).
//     Leva só o nome (escapado), o número do recibo e o link de "Meus recibos".
//     Nada de valores, datas, tipo de tratamento, motivo da anulação nem PDF
//     (o recibo tem dados de saúde; o aluno baixa pelo portal).
//   - Não existe preferência/descadastro de email no projeto; este aviso é
//     transacional (documento do próprio aluno) e sai sempre que houver email.

import { escapeHtml, normalizeEmail, STUDIO_FROM, type Caller, type OutgoingEmail } from './policy.ts'
import { cleanWelcomeName, normalizeLanguage, type SignupLanguage } from './signupWelcome.ts'

export type ReceiptEvent = 'issued' | 'voided'
export const RECEIPT_EVENTS: ReceiptEvent[] = ['issued', 'voided']
export const NOTICE_WINDOW_MS = 15 * 60 * 1000
export const RECEIPTS_URL = 'https://josipilates.com/student/receipts'
const STUDIO_PHONE = '+1(438)274-8396'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface ReceiptNoticeRequest {
  receiptId: string
  event: ReceiptEvent
}

// Colunas lidas pelo index.ts (insurance_receipts e profiles).
export interface NoticeReceipt {
  id: string
  receipt_number: string
  student_id: string
  status: string
  issued_at: string | null
  voided_at: string | null
}
export interface NoticeStudent {
  email: string | null
  full_name: string | null
  preferred_language: string | null
  deleted_at: string | null
}

export type ReceiptNoticeResult =
  | { kind: 'send'; email: OutgoingEmail; idempotencyKey: string }
  | { kind: 'skip'; reason: 'no_email' }
  | { kind: 'fail'; status: number; error: string }

const fail = (status: number, error: string): ReceiptNoticeResult => ({ kind: 'fail', status, error })

// deno-lint-ignore no-explicit-any
export function isReceiptNoticeBody(body: any): boolean {
  return Boolean(body) && typeof body === 'object' && !Array.isArray(body) && body.type === 'receipt_notice'
}

export function authorizeReceiptNotice(caller: Caller): ReceiptNoticeResult | null {
  if (caller.kind === 'anonymous') return fail(401, 'Unauthorized')
  if (caller.kind !== 'staff') return fail(403, 'Forbidden')
  return null
}

// deno-lint-ignore no-explicit-any
export function readReceiptNoticeRequest(body: any): ReceiptNoticeRequest | null {
  const id = typeof body?.receipt_id === 'string' ? body.receipt_id.trim() : ''
  const event = body?.event
  if (!UUID_RE.test(id)) return null
  if (!(RECEIPT_EVENTS as unknown[]).includes(event)) return null
  return { receiptId: id.toLowerCase(), event: event as ReceiptEvent }
}

export const receiptNoticeIdempotencyKey = (receiptId: string, event: ReceiptEvent) =>
  `receipt-notice/${receiptId}/${event}`

// Dentro da janela: no máximo NOTICE_WINDOW_MS atrás (e até 1 min "no futuro",
// diferença de relógio entre banco e função).
function withinWindow(iso: string | null, now: number): boolean {
  const at = iso ? Date.parse(iso) : NaN
  return Number.isFinite(at) && now - at <= NOTICE_WINDOW_MS && now - at >= -60_000
}

interface EventTexts {
  subject: string
  title: string
  intro: (receiptNumber: string) => string
  body: string
  privacy: string
}
interface NoticeTexts {
  greeting: (name: string) => string
  issued: EventTexts
  voided: EventTexts
  button: string
  loginHint: string
  contact: string
  signature: string
  teamName: string
}

export const NOTICE_TEXTS: Record<SignupLanguage, NoticeTexts> = {
  pt: {
    greeting: (name) => (name ? `Olá, ${name}!` : 'Olá!'),
    issued: {
      subject: 'Seu recibo de seguro está disponível',
      title: 'Recibo de seguro disponível',
      intro: (n) => `Emitimos um recibo de seguro para você: nº ${n}.`,
      body: 'Para baixar o PDF e enviar ao seu seguro, entre no Portal do Aluno e abra "Meus recibos".',
      privacy: 'Por segurança, o recibo não vai anexado a este e-mail.',
    },
    voided: {
      subject: 'Um recibo de seguro foi anulado',
      title: 'Recibo de seguro anulado',
      intro: (n) => `O recibo de seguro nº ${n} foi anulado e não vale mais.`,
      body: 'Se você já enviou este recibo ao seu seguro, fale com a gente. Se um recibo novo foi emitido no lugar dele, ele está em "Meus recibos", no Portal do Aluno.',
      privacy: '',
    },
    button: 'Ver meus recibos',
    loginHint: 'Se você não estiver conectado(a), entre no Portal do Aluno com o seu e-mail e a sua senha e toque em "Meus recibos".',
    contact: `Dúvidas? Mande uma mensagem pelo WhatsApp: ${STUDIO_PHONE}`,
    signature: 'Com carinho,',
    teamName: 'Equipe Josi Pilates',
  },
  en: {
    greeting: (name) => (name ? `Hello, ${name}!` : 'Hello!'),
    issued: {
      subject: 'Your insurance receipt is available',
      title: 'Insurance receipt available',
      intro: (n) => `We have issued an insurance receipt for you: no. ${n}.`,
      body: 'To download the PDF and send it to your insurer, log in to the Student Portal and open "My receipts".',
      privacy: 'For your privacy, the receipt is not attached to this email.',
    },
    voided: {
      subject: 'An insurance receipt was voided',
      title: 'Insurance receipt voided',
      intro: (n) => `Insurance receipt no. ${n} was voided and is no longer valid.`,
      body: 'If you have already sent this receipt to your insurer, please contact us. If a new receipt was issued to replace it, you will find it in "My receipts" on the Student Portal.',
      privacy: '',
    },
    button: 'See my receipts',
    loginHint: 'If you are not logged in, log in to the Student Portal with your email and password, then tap "My receipts".',
    contact: `Questions? Send us a message on WhatsApp: ${STUDIO_PHONE}`,
    signature: 'With care,',
    teamName: 'Josi Pilates Team',
  },
  fr: {
    greeting: (name) => (name ? `Bonjour, ${name}!` : 'Bonjour!'),
    issued: {
      subject: "Votre reçu d'assurance est disponible",
      title: "Reçu d'assurance disponible",
      intro: (n) => `Nous avons émis un reçu d'assurance à votre nom : nº ${n}.`,
      body: "Pour télécharger le PDF et l'envoyer à votre assureur, connectez-vous au Portail Étudiant et ouvrez « Mes reçus ».",
      privacy: "Pour protéger vos renseignements, le reçu n'est pas joint à ce courriel.",
    },
    voided: {
      subject: "Un reçu d'assurance a été annulé",
      title: "Reçu d'assurance annulé",
      intro: (n) => `Le reçu d'assurance nº ${n} a été annulé et n'est plus valide.`,
      body: 'Si vous avez déjà envoyé ce reçu à votre assureur, contactez-nous. Si un nouveau reçu a été émis pour le remplacer, vous le trouverez dans « Mes reçus », sur le Portail Étudiant.',
      privacy: '',
    },
    button: 'Voir mes reçus',
    loginHint: "Si vous n'êtes pas connecté(e), connectez-vous au Portail Étudiant avec votre courriel et votre mot de passe, puis touchez « Mes reçus ».",
    contact: `Des questions ? Envoyez-nous un message sur WhatsApp : ${STUDIO_PHONE}`,
    signature: 'Avec soin,',
    teamName: 'Équipe Josi Pilates',
  },
}

export function buildReceiptNoticeContent(
  event: ReceiptEvent,
  receiptNumber: unknown,
  rawName: unknown,
  rawLanguage: unknown,
): { subject: string; html: string; text: string } {
  const t = NOTICE_TEXTS[normalizeLanguage(rawLanguage)]
  const e = t[event]
  const name = cleanWelcomeName(rawName)
  const number = cleanWelcomeName(receiptNumber)
  const safeName = escapeHtml(name)
  const safeNumber = escapeHtml(number)

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${e.title}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #01b48d 0%, #017a6b 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">Josi Pilates</h1>
    <p style="color: #f0f0f0; margin: 5px 0 0 0; font-size: 16px;">${e.title}</p>
  </div>
  <div style="background: white; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 10px 10px;">
    <h2 style="color: #1e293b; margin-top: 0;">${t.greeting(safeName)}</h2>
    <p>${e.intro(safeNumber)}</p>
    <p>${e.body}</p>
    <div style="text-align: center; margin: 25px 0; padding: 18px; background-color: #f0fdf4; border-radius: 8px; border: 1px solid #bbf7d0;">
      <a href="${RECEIPTS_URL}" style="background: linear-gradient(135deg, #01b48d 0%, #017a6b 100%); color: white; padding: 12px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 15px;">${t.button}</a>
    </div>
    <p style="color: #64748b; font-size: 14px;">${t.loginHint}</p>
    ${e.privacy ? `<p style="color: #64748b; font-size: 14px;">${e.privacy}</p>` : ''}
    <p>${t.contact}</p>
    <hr style="margin: 30px 0; border: none; border-top: 1px solid #e2e8f0;">
    <p style="color: #64748b; font-size: 14px; text-align: center;">
      <strong>${t.signature}</strong><br>
      ${t.teamName}
    </p>
  </div>
</body>
</html>`

  const text = `${t.greeting(name)}

${e.intro(number)}

${e.body}

${t.button}: ${RECEIPTS_URL}

${t.loginHint}${e.privacy ? `\n${e.privacy}` : ''}

${t.contact}

${t.signature}
${t.teamName}`

  return { subject: e.subject, html, text }
}

export function buildReceiptNotice(args: {
  request: ReceiptNoticeRequest
  receipt: NoticeReceipt | null
  student: NoticeStudent | null
  now?: number
}): ReceiptNoticeResult {
  const { request, receipt, student } = args
  const now = args.now ?? Date.now()
  if (!receipt || String(receipt.id).toLowerCase() !== request.receiptId) return fail(404, 'Receipt not found')

  const expectedStatus = request.event === 'issued' ? 'issued' : 'void'
  const eventAt = request.event === 'issued' ? receipt.issued_at : receipt.voided_at
  if (receipt.status !== expectedStatus || !withinWindow(eventAt, now)) return fail(409, 'Notice not allowed')

  const to = student && !student.deleted_at ? normalizeEmail(student.email) : null
  if (!to) return { kind: 'skip', reason: 'no_email' }

  const content = buildReceiptNoticeContent(
    request.event,
    receipt.receipt_number,
    student?.full_name,
    student?.preferred_language,
  )
  return {
    kind: 'send',
    email: { from: STUDIO_FROM, to: [to], ...content, attachments: [] },
    idempotencyKey: receiptNoticeIdempotencyKey(request.receiptId, request.event),
  }
}
