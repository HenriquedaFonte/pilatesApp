// Regras de quem pode mandar o quê pela Edge Function send-email.
// Módulo puro (sem Deno, sem rede): o index.ts resolve quem chama e chama
// buildEmail(); os testes em src/tests/sendEmailPolicy.test.js usam este arquivo.
//
//   - service_role (ex.: Edge Function reset-password) e professora/admin
//     (profiles.role in ('teacher','admin'), mesmo critério de public.is_staff()):
//     destinatários livres, assunto/HTML livres.
//   - formulário de contato do site (type: 'contact'), com ou sem login:
//     destinatário fixo (caixa do estúdio); o servidor monta o email a partir de
//     nome, email e mensagem (escapados); Reply-To = email do visitante.
//   - aluno logado (cadastro público): só o email de boas-vindas do cadastro
//     (type: 'signup_welcome'), montado no servidor com texto fixo (pt/en/fr),
//     nome e idioma lidos do perfil no servidor (nome escapado); só para o
//     próprio email do login, nos 30 minutos depois de criar a conta e uma vez
//     só (marca em app_metadata, gravada pelo index.ts). Assunto/HTML livres,
//     outro destinatário, anexo ou Reply-To: recusado.
//   - sem login, fora do contato: recusado.
// O remetente é sempre STUDIO_FROM; o "from" que vem do cliente é ignorado.

import { buildSignupWelcomeContent } from './signupWelcome.ts'

export const STUDIO_FROM = 'Josi Pilates <josi@josipilates.com>'
export const STUDIO_INBOX = 'josipilatesmontreal@gmail.com'

// Anexos só por nome, de uma lista fixa; o servidor busca do endereço daqui
// (o "path" que vem do cliente é ignorado: nada de URL livre nem arquivo local).
export const ALLOWED_ATTACHMENTS: Record<string, { url: string; contentType: string }> = {
  'PilatesLessonsPolicies.pdf': {
    url: 'https://josipilates.com/PilatesLessonsPolicies.pdf',
    contentType: 'application/pdf',
  },
}

export const SELF_SIGNUP_WINDOW_MS = 30 * 60 * 1000
export const MAX_RECIPIENTS = 50
const MAX_SUBJECT = 300
const MAX_BODY = 500_000
const MAX_CONTACT_NAME = 250
const MAX_CONTACT_MESSAGE = 5000

export type Caller =
  | { kind: 'service' }
  | { kind: 'staff'; userId: string }
  | {
      kind: 'user'
      userId: string
      email: string
      createdAt: string | null
      fullName?: string | null // profiles.full_name (ou user_metadata), lido no servidor
      language?: string | null // profiles.preferred_language (ou user_metadata)
      welcomeSentAt?: string | null // app_metadata.welcome_email_sent_at
    }
  | { kind: 'anonymous' }

export interface OutgoingEmail {
  from: string
  to: string[]
  subject: string
  html: string
  text: string
  reply_to?: string
  attachments: string[] // nomes de ALLOWED_ATTACHMENTS
}

export type BuildResult =
  | { ok: true; mode: 'staff' | 'contact' | 'signup_welcome'; email: OutgoingEmail }
  | { ok: false; status: number; error: string }

const EMAIL_RE = /^[^\s@<>,;"'()\\]+@[^\s@<>,;"'()\\]+\.[^\s@<>,;"'()\\]+$/

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const v = value.trim()
  if (v.length === 0 || v.length > 254 || !EMAIL_RE.test(v)) return null
  return v
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function oneLine(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim()
}

function fail(status: number, error: string): BuildResult {
  return { ok: false, status, error }
}

// deno-lint-ignore no-explicit-any
type Body = Record<string, any>

function readSubjectAndBody(body: Body): { subject: string; html: string; text: string } | null {
  const subject = typeof body.subject === 'string' ? oneLine(body.subject) : ''
  const html = typeof body.html === 'string' ? body.html : ''
  const text = typeof body.text === 'string' ? body.text : ''
  if (!subject || subject.length > MAX_SUBJECT) return null
  if (!html && !text) return null
  if (html.length > MAX_BODY || text.length > MAX_BODY) return null
  return { subject, html, text }
}

function readRecipients(raw: unknown): string[] | null {
  const list = Array.isArray(raw) ? raw : [raw]
  if (list.length === 0 || list.length > MAX_RECIPIENTS) return null
  const out: string[] = []
  for (const item of list) {
    const e = normalizeEmail(item)
    if (!e) return null
    out.push(e)
  }
  return out
}

function readAttachments(raw: unknown): string[] | null {
  if (raw === undefined || raw === null) return []
  if (!Array.isArray(raw)) return null
  const names: string[] = []
  for (const a of raw) {
    const name = a && typeof a.filename === 'string' ? a.filename : ''
    if (!Object.prototype.hasOwnProperty.call(ALLOWED_ATTACHMENTS, name)) return null
    if (!names.includes(name)) names.push(name)
  }
  return names
}

export function buildContactEmail(body: Body): BuildResult {
  const name = typeof body.name === 'string' ? oneLine(body.name) : ''
  const email = normalizeEmail(body.email)
  const message = typeof body.message === 'string' ? body.message.trim() : ''
  if (!name || name.length > MAX_CONTACT_NAME) return fail(400, 'Invalid name')
  if (!email) return fail(400, 'Invalid email')
  if (!message || message.length > MAX_CONTACT_MESSAGE) return fail(400, 'Invalid message')

  const subject = `Contact Form Message from ${name}`
  const safeName = escapeHtml(name)
  const safeEmail = escapeHtml(email)
  const safeMessage = escapeHtml(message).replace(/\r?\n/g, '<br>')

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Contact Form Message</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #01b48d 0%, #017a6b 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">Josi Pilates</h1>
    <p style="color: #f0f0f0; margin: 5px 0 0 0; font-size: 16px;">Contact Form Message</p>
  </div>
  <div style="background: white; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 10px 10px;">
    <h2 style="color: #1e293b; margin-top: 0;">New Contact Form Submission</h2>
    <div style="background-color: #f1f5f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <h3 style="color: #374151; margin-top: 0;">Contact Details</h3>
      <p style="margin: 5px 0;"><strong>Name:</strong> ${safeName}</p>
      <p style="margin: 5px 0;"><strong>Email:</strong> ${safeEmail}</p>
    </div>
    <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
      <h3 style="color: #1e293b; margin-top: 0;">Message</h3>
      <p style="margin: 10px 0;">${safeMessage}</p>
    </div>
    <hr style="margin: 30px 0; border: none; border-top: 1px solid #e2e8f0;">
    <p style="color: #64748b; font-size: 14px; text-align: center;">
      This message was sent from the Josi Pilates website contact form.
    </p>
  </div>
</body>
</html>`

  const text = `New contact form submission:

Name: ${name}
Email: ${email}

Message:
${message}

Sent from Josi Pilates website contact form.`

  return {
    ok: true,
    mode: 'contact',
    email: { from: STUDIO_FROM, to: [STUDIO_INBOX], subject, html, text, reply_to: email, attachments: [] },
  }
}

// Boas-vindas do cadastro público: o cliente só pede (type: 'signup_welcome');
// destinatário, assunto e corpo vêm do servidor. Campos do cliente são ignorados.
export function buildSignupWelcomeEmail(caller: Caller, now: number = Date.now()): BuildResult {
  if (caller.kind === 'anonymous') return fail(401, 'Unauthorized')
  if (caller.kind !== 'user') return fail(403, 'Forbidden')
  const own = normalizeEmail(caller.email)
  if (!own) return fail(403, 'Forbidden')
  const created = caller.createdAt ? Date.parse(caller.createdAt) : NaN
  if (!Number.isFinite(created) || now - created > SELF_SIGNUP_WINDOW_MS || now - created < -60_000) {
    return fail(403, 'Forbidden')
  }
  if (caller.welcomeSentAt) return fail(409, 'Already sent')
  const content = buildSignupWelcomeContent(caller.fullName, caller.language)
  return {
    ok: true,
    mode: 'signup_welcome',
    email: { from: STUDIO_FROM, to: [own], ...content, attachments: [] },
  }
}

export function buildEmail(body: Body, caller: Caller, now: number = Date.now()): BuildResult {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return fail(400, 'Invalid request')

  if (body.type === 'contact') return buildContactEmail(body)

  if (caller.kind === 'anonymous') return fail(401, 'Unauthorized')

  if (body.type === 'signup_welcome') return buildSignupWelcomeEmail(caller, now)

  // Conta sem papel de professora: nada além dos dois casos acima.
  if (caller.kind !== 'service' && caller.kind !== 'staff') return fail(403, 'Forbidden')

  const content = readSubjectAndBody(body)
  if (!content) return fail(400, 'Invalid subject or content')

  const to = readRecipients(body.to)
  if (!to) return fail(400, 'Invalid recipients')
  let replyTo: string | undefined
  if (body.reply_to !== undefined && body.reply_to !== null && body.reply_to !== '') {
    const r = normalizeEmail(body.reply_to)
    if (!r) return fail(400, 'Invalid reply_to')
    replyTo = r
  }
  const attachments = readAttachments(body.attachments)
  if (!attachments) return fail(400, 'Attachment not allowed')
  return {
    ok: true,
    mode: 'staff',
    email: { from: STUDIO_FROM, to, ...content, ...(replyTo && { reply_to: replyTo }), attachments },
  }
}
