import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  attachmentSpec,
  authorize,
  type CampaignRow,
  type Caller,
  campaignGate,
  CLAIM_BATCH,
  classifyResend,
  type ClaimedRecipient,
  idempotencyKey,
  LEASE_SECONDS,
  logSubjectOf,
  outOfTime,
  parseRequest,
  prepareEmail,
  RATE_LIMIT_PAUSE_MS,
  RESEND_TIMEOUT_MS,
  SEND_DELAY_MS,
  shouldContinue,
  STALE_CLAIM_SECONDS,
  STUDIO_FROM,
} from './campaign.ts'

// Envio de uma campanha pelo servidor (Story 4.5). Regras: ver campaign.ts.
//
// Como funciona:
//   1. O site cria a campanha (email_campaigns), põe os alunos na fila
//      (queue_email_campaign) e chama esta função só com { campaign_id }.
//   2. A função confere quem chama (professora/admin ou service_role), pega
//      a "vez" da campanha (email_campaign_acquire_worker: uma chamada por vez)
//      e responde 202 na hora. O envio continua em segundo plano
//      (EdgeRuntime.waitUntil): a página pode ser fechada.
//   3. Em lotes (email_campaign_claim, atômico): monta cada email a partir da
//      campanha e do perfil do aluno, manda pelo Resend (com chave de
//      idempotência por aluno) e grava o resultado (email_campaign_record →
//      email_notifications + contadores). Pausa entre emails.
//   4. Perto do limite de tempo da plataforma, devolve a vez e chama a si
//      mesma (service_role) para continuar. Quando a fila acaba, a campanha
//      fica done/failed.
//   5. Se tudo isso parar (ex.: a chamada seguinte não sair), chamar de novo
//      (a tela faz isso sozinha enquanto estiver aberta; no Histórico há o
//      botão "Continuar envio") continua de onde parou: quem já recebeu não
//      recebe de novo.
//
// Logs: só ids e contagens (nunca email, nome ou conteúdo). Erro do Resend
// não volta ao navegador (a resposta é só o status do envio).

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

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const env = (name: string) => Deno.env.get(name) ?? ''

async function resolveCaller(authHeader: string, admin: SupabaseClient): Promise<Caller> {
  const serviceRoleKey = env('SUPABASE_SERVICE_ROLE_KEY')
  if (serviceRoleKey && authHeader === `Bearer ${serviceRoleKey}`) return { kind: 'service' }
  if (!authHeader) return { kind: 'anonymous' }

  const userClient = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return { kind: 'anonymous' }

  // Mesmo critério de public.is_staff(): role in ('teacher', 'admin').
  const { data: profile, error } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (!error && (profile?.role === 'teacher' || profile?.role === 'admin')) {
    return { kind: 'staff', userId: user.id }
  }
  return { kind: 'user', userId: user.id }
}

// PDF do termo de consentimento: buscado uma vez por chamada, do endereço fixo
// da lista da send-email (nada de URL vinda do navegador).
async function loadAttachment(name: string) {
  const spec = attachmentSpec(name)
  if (!spec) return null
  const res = await fetch(spec.url, { signal: AbortSignal.timeout(RESEND_TIMEOUT_MS) })
  if (!res.ok) {
    console.error(`send-campaign: attachment fetch failed (status ${res.status})`)
    return null
  }
  const bytes = new Uint8Array(await res.arrayBuffer())
  let binary = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return { filename: name, content: btoa(binary), type: spec.contentType }
}

interface WorkerCtx {
  admin: SupabaseClient
  campaign: CampaignRow
  token: string
  hop: number
  resendApiKey: string
}

async function sendOne(ctx: WorkerCtx, r: ClaimedRecipient, attachments: Map<string, unknown>) {
  const prepared = prepareEmail(ctx.campaign, r)
  if (!prepared.ok) return { outcome: 'failed' as const, error: prepared.error, providerId: null, pause: false, to: r.email }

  // deno-lint-ignore no-explicit-any
  const payload: Record<string, any> = {
    from: STUDIO_FROM,
    to: [prepared.to],
    subject: prepared.email.subject,
    html: prepared.email.html,
    text: prepared.email.text,
  }
  if (prepared.email.attachments.length > 0) {
    const loaded = []
    for (const name of prepared.email.attachments) {
      if (!attachments.has(name)) attachments.set(name, await loadAttachment(name).catch(() => null))
      const a = attachments.get(name)
      if (a) loaded.push(a)
    }
    // Termo sem o PDF não sai: tenta de novo depois (ou falha na última tentativa).
    if (loaded.length < prepared.email.attachments.length) {
      const o = classifyResend(503, { name: 'attachment_unavailable' }, r.attempts)
      return { ...o, error: o.error ? 'attachment_unavailable' : null, to: prepared.to }
    }
    payload.attachments = loaded
  }

  let status: number | null = null
  // deno-lint-ignore no-explicit-any
  let body: any = null
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ctx.resendApiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey(ctx.campaign.id, r.student_id),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(RESEND_TIMEOUT_MS),
    })
    status = res.status
    body = await res.json().catch(() => null)
  } catch {
    status = null // rede/timeout
  }
  return { ...classifyResend(status, body, r.attempts), to: prepared.to }
}

async function runWorker(ctx: WorkerCtx) {
  const startedAt = Date.now()
  const counts = { sent: 0, failed: 0, retry: 0, ignored: 0 }
  const attachments = new Map<string, unknown>()
  const logSubject = logSubjectOf(ctx.campaign)
  let stoppedForTime = false
  let finalStatus: string | null = null

  try {
    while (true) {
      if (outOfTime(startedAt, Date.now())) {
        stoppedForTime = true
        break
      }
      const { data: batch, error: claimError } = await ctx.admin.rpc('email_campaign_claim', {
        p_campaign_id: ctx.campaign.id,
        p_token: ctx.token,
        p_limit: CLAIM_BATCH,
        p_stale_seconds: STALE_CLAIM_SECONDS,
      })
      if (claimError) {
        console.error(`send-campaign: claim failed campaign=${ctx.campaign.id} code=${claimError.code ?? 'unknown'}`)
        break
      }
      const rows = (batch ?? []) as ClaimedRecipient[]
      if (rows.length === 0) {
        const { data } = await ctx.admin.rpc('email_campaign_finish_if_done', { p_campaign_id: ctx.campaign.id })
        finalStatus = typeof data === 'string' ? data : null
        break
      }

      for (const r of rows) {
        const result = await sendOne(ctx, r, attachments)
        const { data: recorded, error: recordError } = await ctx.admin.rpc('email_campaign_record', {
          p_campaign_id: ctx.campaign.id,
          p_student_id: r.student_id,
          p_claim_token: r.claim_token,
          p_outcome: result.outcome,
          p_error: result.error,
          p_provider_id: result.providerId,
          p_recipient_email: result.to ?? r.email ?? '',
          p_subject: logSubject,
        })
        if (recordError) {
          // A linha fica "enviando" e volta à fila depois de STALE_CLAIM_SECONDS
          // (a chave de idempotência evita email repetido).
          console.error(`send-campaign: record failed campaign=${ctx.campaign.id} code=${recordError.code ?? 'unknown'}`)
        } else if (recorded === 'ignored') {
          counts.ignored++
        } else {
          counts[result.outcome]++
        }
        await sleep(result.pause ? RATE_LIMIT_PAUSE_MS : SEND_DELAY_MS)
      }
    }
  } catch (error) {
    console.error(`send-campaign: worker error campaign=${ctx.campaign.id}`, error instanceof Error ? error.name : 'unknown')
  } finally {
    await ctx.admin.rpc('email_campaign_release_worker', { p_campaign_id: ctx.campaign.id, p_token: ctx.token })
    console.log(
      `send-campaign: campaign=${ctx.campaign.id} hop=${ctx.hop} sent=${counts.sent} failed=${counts.failed} ` +
        `retry=${counts.retry} ignored=${counts.ignored} ms=${Date.now() - startedAt} ` +
        `status=${finalStatus ?? 'sending'}${stoppedForTime ? ' continue=yes' : ''}`,
    )
  }

  if (shouldContinue({ stoppedForTime, hop: ctx.hop })) {
    try {
      const res = await fetch(`${env('SUPABASE_URL')}/functions/v1/send-campaign`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env('SUPABASE_SERVICE_ROLE_KEY')}`,
          'apikey': env('SUPABASE_SERVICE_ROLE_KEY'),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ campaign_id: ctx.campaign.id, hop: ctx.hop + 1 }),
        signal: AbortSignal.timeout(20_000),
      })
      await res.body?.cancel()
      if (!res.ok) console.error(`send-campaign: continue failed campaign=${ctx.campaign.id} status=${res.status}`)
    } catch {
      console.error(`send-campaign: continue failed campaign=${ctx.campaign.id} (network)`)
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return json({ error: 'Invalid request' }, 400)
    }

    const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'))
    const caller = await resolveCaller(req.headers.get('Authorization') ?? '', admin)
    const auth = authorize(caller)
    if (!auth.ok) {
      console.warn(`send-campaign refused: caller=${caller.kind} status=${auth.status}`)
      return json({ error: auth.error }, auth.status)
    }
    const parsed = parseRequest(body, caller)
    if (!parsed.ok) return json({ error: parsed.error }, parsed.status)

    const { data: campaign, error: loadError } = await admin
      .from('email_campaigns')
      .select('id, email_type, subject_pt, subject_en, subject_fr, message_pt, message_en, message_fr, sender_name, status, send_mode')
      .eq('id', parsed.campaignId)
      .maybeSingle()
    if (loadError) {
      console.error(`send-campaign: load failed campaign=${parsed.campaignId} code=${loadError.code ?? 'unknown'}`)
      return json({ error: 'Internal server error' }, 500)
    }
    const gate = campaignGate(campaign as CampaignRow | null)
    if (!gate.ok) {
      if (gate.status === 200) return json({ status: gate.campaignStatus }, 200)
      return json({ error: gate.error }, gate.status)
    }

    const resendApiKey = env('RESEND_API_KEY')
    if (!resendApiKey) {
      console.error('send-campaign: RESEND_API_KEY not configured')
      return json({ error: 'Email service not configured' }, 500)
    }

    const { data: token, error: leaseError } = await admin.rpc('email_campaign_acquire_worker', {
      p_campaign_id: parsed.campaignId,
      p_lease_seconds: LEASE_SECONDS,
    })
    if (leaseError) {
      console.error(`send-campaign: lease failed campaign=${parsed.campaignId} code=${leaseError.code ?? 'unknown'}`)
      return json({ error: 'Internal server error' }, 500)
    }
    if (!token) return json({ status: 'running' }, 202) // outra chamada já está enviando

    const work = runWorker({
      admin,
      campaign: campaign as CampaignRow,
      token: token as string,
      hop: parsed.hop,
      resendApiKey,
    })
    // deno-lint-ignore no-explicit-any
    const runtime = (globalThis as any).EdgeRuntime
    if (runtime?.waitUntil) {
      runtime.waitUntil(work)
    } else {
      await work // fora do Supabase (ex.: teste local), espera terminar
    }
    return json({ status: 'started' }, 202)
  } catch (error) {
    console.error('send-campaign: unexpected error', error instanceof Error ? error.name : 'unknown')
    return json({ error: 'Internal server error' }, 500)
  }
})
