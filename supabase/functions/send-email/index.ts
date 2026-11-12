import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { ALLOWED_ATTACHMENTS, buildEmail, type Caller } from './policy.ts'

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
    .select('role')
    .eq('id', user.id)
    .single()
  if (!error && (profile?.role === 'teacher' || profile?.role === 'admin')) {
    return { kind: 'staff', userId: user.id }
  }
  return { kind: 'user', userId: user.id, email: user.email ?? '', createdAt: user.created_at ?? null }
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
    // deno-lint-ignore no-explicit-any
    const result = buildEmail(body as any, caller)
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
      },
      body: JSON.stringify(resendPayload),
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      // Só o necessário no log; nada do erro bruto do Resend volta ao chamador.
      console.error(`Resend error: status=${response.status} name=${data?.name ?? 'unknown'}`)
      return json({ error: 'Failed to send email' }, 502)
    }

    console.log(`Email sent: id=${data?.id} mode=${result.mode} caller=${caller.kind} recipients=${email.to.length}`)
    return json({ success: true, data: { id: data?.id } }, 200)
  } catch (error) {
    console.error('Unexpected error:', error instanceof Error ? error.message : 'unknown')
    return json({ error: 'Internal server error' }, 500)
  }
})
