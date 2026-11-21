import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { ALLOWED_ATTACHMENTS, buildEmail, type BuildResult, type Caller } from './policy.ts'
import {
  authorizeReceiptNotice,
  buildReceiptNotice,
  isReceiptNoticeBody,
  readReceiptNoticeRequest,
  type NoticeStudent,
  type ReceiptNoticeResult,
} from './receiptNotice.ts'

// Quem pode mandar o quê: ver policy.ts.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function resolveCaller(authHeader: string): Promise<Caller> {
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (serviceRoleKey && authHeader === `Bearer ${serviceRoleKey}`) {
    return { kind: 'service' }
  }
  if (!authHeader) return { kind: 'anonymous' }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return { kind: 'anonymous' }

  // Mesmo critério de public.is_staff(): role in ('teacher', 'admin').
  // Lido com service_role (como em manage-student/create-user).
  const adminClient = createClient(supabaseUrl, serviceRoleKey)
  const { data: profile, error } = await adminClient
    .from('profiles')
    .select('role, full_name, preferred_language')
    .eq('id', user.id)
    .single()
  if (!error && (profile?.role === 'teacher' || profile?.role === 'admin')) {
    return { kind: 'staff', userId: user.id }
  }
  // Nome e idioma para o email de boas-vindas: do perfil (criado pelo trigger
  // handle_new_user), senão do user_metadata do cadastro. Nunca do corpo do pedido.
  const meta = user.user_metadata ?? {}
  return {
    kind: 'user',
    userId: user.id,
    email: user.email ?? '',
    createdAt: user.created_at ?? null,
    fullName: (!error && profile?.full_name) || meta.full_name || null,
    language: (!error && profile?.preferred_language) || meta.preferred_language || null,
    welcomeSentAt: user.app_metadata?.welcome_email_sent_at ?? null,
  }
}

// Marca "boas-vindas enviado" em app_metadata (o usuário não altera app_metadata;
// só service_role). Sem migration. Marca antes de enviar, para não repetir.
async function setWelcomeSentAt(userId: string, value: string | null): Promise<boolean> {
  const adminClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
  const { data, error: getError } = await adminClient.auth.admin.getUserById(userId)
  if (getError || !data?.user) return false
  const { error } = await adminClient.auth.admin.updateUserById(userId, {
    app_metadata: { ...(data.user.app_metadata ?? {}), welcome_email_sent_at: value },
  })
  return !error
}

async function loadAttachment(name: string) {
  const spec = ALLOWED_ATTACHMENTS[name]
  const res = await fetch(spec.url)
  if (!res.ok) {
    console.error(`Attachment fetch failed: ${name} (status ${res.status})`)
    return null
  }
  const bytes = new Uint8Array(await res.arrayBuffer())
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return { filename: name, content: btoa(binary), type: spec.contentType }
}

// Aviso de recibo ao aluno: lê o recibo e o perfil com service_role (o
// destinatário vem do banco, nunca do pedido). Ver receiptNotice.ts.
// deno-lint-ignore no-explicit-any
async function handleReceiptNotice(body: any, caller: Caller): Promise<ReceiptNoticeResult> {
  const denied = authorizeReceiptNotice(caller)
  if (denied) return denied
  const request = readReceiptNoticeRequest(body)
  if (!request) return { kind: 'fail', status: 400, error: 'Invalid request' }

  const adminClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
  const { data: receipt, error: receiptError } = await adminClient
    .from('insurance_receipts')
    .select('id, receipt_number, student_id, status, issued_at, voided_at')
    .eq('id', request.receiptId)
    .maybeSingle()
  if (receiptError) {
    console.error('send-email: receipt_notice could not read the receipt')
    return { kind: 'fail', status: 500, error: 'Internal server error' }
  }

  let student: NoticeStudent | null = null
  if (receipt) {
    const { data, error } = await adminClient
      .from('profiles')
      .select('email, full_name, preferred_language, deleted_at')
      .eq('id', receipt.student_id)
      .maybeSingle()
    if (error) {
      console.error('send-email: receipt_notice could not read the student profile')
      return { kind: 'fail', status: 500, error: 'Internal server error' }
    }
    student = data
  }

  return buildReceiptNotice({ request, receipt, student, now: Date.now() })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  try {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return json({ error: 'Invalid request' }, 400)
    }

    const caller = await resolveCaller(req.headers.get('Authorization') ?? '')
    let result: BuildResult
    let idempotencyKey: string | null = null
    if (isReceiptNoticeBody(body)) {
      const notice = await handleReceiptNotice(body, caller)
      if (notice.kind === 'fail') {
        console.warn(`send-email refused: caller=${caller.kind} mode=receipt_notice status=${notice.status} reason=${notice.error}`)
        return json({ error: notice.error }, notice.status)
      }
      if (notice.kind === 'skip') {
        // Sem email no cadastro (ou perfil na lixeira): nada sai. Sem email/nome no log.
        console.log(`send-email: receipt_notice skipped reason=${notice.reason}`)
        return json({ success: false, skipped: notice.reason }, 200)
      }
      result = { ok: true, mode: 'receipt_notice', email: notice.email }
      idempotencyKey = notice.idempotencyKey
    } else {
      // deno-lint-ignore no-explicit-any
      result = buildEmail(body as any, caller)
    }
    if (!result.ok) {
      console.warn(`send-email refused: caller=${caller.kind} status=${result.status} reason=${result.error}`)
      return json({ error: result.error }, result.status)
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      console.error('RESEND_API_KEY not configured')
      return json({ error: 'Email service not configured' }, 500)
    }

    const { email } = result

    let welcomeClaimed = false
    if (result.mode === 'signup_welcome' && caller.kind === 'user') {
      if (!(await setWelcomeSentAt(caller.userId, new Date().toISOString()))) {
        console.error('send-email: could not mark welcome email as sent')
        return json({ error: 'Internal server error' }, 500)
      }
      welcomeClaimed = true
    }
    // deno-lint-ignore no-explicit-any
    const resendPayload: Record<string, any> = {
      from: email.from,
      to: email.to,
      subject: email.subject,
      ...(email.html && { html: email.html }),
      ...(email.text && { text: email.text }),
      ...(email.reply_to && { reply_to: email.reply_to }),
    }

    if (email.attachments.length > 0) {
      const loaded = []
      for (const name of email.attachments) {
        try {
          const a = await loadAttachment(name)
          if (a) loaded.push(a)
        } catch (err) {
          console.error(`Attachment error: ${name}`, err instanceof Error ? err.message : 'unknown')
        }
      }
      if (loaded.length > 0) resendPayload.attachments = loaded
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
        // Aviso de recibo: o mesmo recibo/evento em 24 h não manda outro email.
        ...(idempotencyKey && { 'Idempotency-Key': idempotencyKey }),
      },
      body: JSON.stringify(resendPayload),
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      // Só o necessário no log; nada do erro bruto do Resend volta ao chamador.
      console.error(`Resend error: status=${response.status} name=${data?.name ?? 'unknown'}`)
      // Boas-vindas que não saiu: desfaz a marca para o aluno poder tentar de novo (na janela).
      if (welcomeClaimed && caller.kind === 'user') await setWelcomeSentAt(caller.userId, null).catch(() => false)
      return json({ error: 'Failed to send email' }, 502)
    }

    console.log(`Email sent: id=${data?.id} mode=${result.mode} caller=${caller.kind} recipients=${email.to.length}`)
    return json({ success: true, data: { id: data?.id } }, 200)
  } catch (error) {
    console.error('Unexpected error:', error instanceof Error ? error.message : 'unknown')
    return json({ error: 'Internal server error' }, 500)
  }
})
