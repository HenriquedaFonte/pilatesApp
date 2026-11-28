import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SERVICE_ROLE_SENTINEL_ID    = '00000000-0000-0000-0000-000000000000'
const SERVICE_ROLE_SENTINEL_EMAIL = 'service_role'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader   = req.headers.get('Authorization') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? 'never-match-default';
    const isServiceRole  = authHeader.includes(serviceRoleKey);

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      serviceRoleKey
    )

    // Actor resolution: real user or service-role sentinel
    let actorId    = SERVICE_ROLE_SENTINEL_ID
    let actorEmail = SERVICE_ROLE_SENTINEL_EMAIL

    if (isServiceRole) {
      console.log("Authenticated via Service Role Key (diagnostics bypass)");
    } else {
      const userClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } }
      )

      const { data: { user } } = await userClient.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const { data: profile, error: profileError } = await supabaseClient
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profileError || profile?.role !== 'teacher') {
        throw new Error('Only teachers are authorized to manage student profiles and accounts')
      }

      actorId    = user.id
      actorEmail = user.email ?? ''
    }

    const { action, studentId, email } = await req.json()

    if (!studentId) throw new Error('studentId is required')

    // ── Helper: write to audit_log (always before destructive ops) ──────────
    async function writeAuditLog(
      actionName: string,
      snapshot: Record<string, unknown> | null
    ) {
      const { error } = await supabaseClient.from('audit_log').insert({
        actor_id:      actorId,
        actor_email:   actorEmail,
        action:        actionName,
        target_id:     studentId,
        target_name:   snapshot?.full_name  ?? null,
        target_email:  snapshot?.email      ?? null,
        snapshot_data: snapshot,
      })
      if (error) throw new Error(`Failed to write audit log: ${error.message}`)
    }

    // ── Helper: fetch profile snapshot ────────────────────────────────────────
    async function fetchProfileSnapshot() {
      const { data, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', studentId)
        .single()
      if (error) throw new Error(`Failed to fetch student profile: ${error.message}`)
      return data
    }

    // ── Helper: bloqueia/desbloqueia o login (Supabase Auth) ─────────────────
    // 876000h = o mesmo valor da migration 20261128020000 (não usar infinity).
    // Usuário de auth inexistente: só registra e segue (mesmo critério do
    // hard-delete).
    async function setLoginBlocked(blocked: boolean) {
      const { error } = await supabaseClient.auth.admin.updateUserById(
        studentId,
        { ban_duration: blocked ? '876000h' : 'none' }
      )
      if (error) {
        const isNotFound = error.message?.toLowerCase().includes('not found') || error.status === 404
        if (isNotFound) {
          console.log(`Auth user not found while ${blocked ? 'blocking' : 'unblocking'} login: ${studentId}`)
          return
        }
        throw new Error(`Failed to ${blocked ? 'block' : 'unblock'} student login: ${error.message}`)
      }
    }

    // Só alunos podem ser arquivados/restaurados (sem isso, dava para
    // bloquear o login de uma professora).
    function notAStudentResponse() {
      return new Response(
        JSON.stringify({ error: 'Only students can be archived or restored', code: 'NOT_A_STUDENT' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // ── Action: archive (default "delete" from UI; estado = deleted_at) ──────
    if (action === 'delete') {
      console.log(`Starting archive for student: ${studentId}`)

      const snapshot = await fetchProfileSnapshot()
      if (snapshot?.role !== 'student') return notAStudentResponse()
      const wasArchived = !!snapshot.deleted_at

      // Audit log BEFORE any modification
      await writeAuditLog('student.soft_delete', snapshot)

      // 1) Bloqueia o login
      await setLoginBlocked(true)

      // 2) Arquiva: deleted_at + deleted_by (check_ins, balance_history, recibos,
      //    termo e ficha preservados). Repetir a ação mantém a data original.
      const { error: softErr } = await supabaseClient
        .from('profiles')
        .update({
          deleted_at: snapshot.deleted_at ?? new Date().toISOString(),
          deleted_by: snapshot.deleted_by ?? actorId,
        })
        .eq('id', studentId)
      if (softErr) {
        // Desfaz o bloqueio, a não ser que o aluno já estivesse arquivado
        // (aí ele precisa continuar bloqueado).
        if (!wasArchived) {
          try {
            await setLoginBlocked(false)
          } catch (unbanErr) {
            console.error(`Failed to undo login block after archive error: ${studentId}`, (unbanErr as Error)?.message)
          }
        }
        throw new Error(`Failed to archive student profile: ${softErr.message}`)
      }

      // 3) Remove das turmas. Se falhar, o aluno já está arquivado e bloqueado;
      //    repetir a ação é seguro.
      const { error: linkErr } = await supabaseClient
        .from('student_class_link')
        .delete()
        .eq('student_id', studentId)
      if (linkErr) throw new Error(`Failed to remove student class links: ${linkErr.message}`)

      return new Response(
        JSON.stringify({ success: true, message: 'Student archived.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // ── Action: restore (sai do arquivo) ─────────────────────────────────────
    if (action === 'restore') {
      console.log(`Restoring archived student: ${studentId}`)

      const snapshot = await fetchProfileSnapshot()
      if (snapshot?.role !== 'student') return notAStudentResponse()
      const wasArchived = !!snapshot.deleted_at

      // Audit log before restore
      await writeAuditLog('student.restore', snapshot)

      // 1) Desbloqueia o login
      await setLoginBlocked(false)

      // 2) Sai do arquivo
      const { error: restoreErr } = await supabaseClient
        .from('profiles')
        .update({ deleted_at: null, deleted_by: null })
        .eq('id', studentId)
      if (restoreErr) {
        // Volta a bloquear, se o aluno estava arquivado.
        if (wasArchived) {
          try {
            await setLoginBlocked(true)
          } catch (banErr) {
            console.error(`Failed to re-block login after restore error: ${studentId}`, (banErr as Error)?.message)
          }
        }
        throw new Error(`Failed to restore student: ${restoreErr.message}`)
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Student restored.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // ── Action: hard-delete (permanent, requires friction in UI) ─────────────
    if (action === 'hard-delete') {
      // Recibo de seguro é documento fiscal: os FKs de insurance_receipts para
      // profiles não têm CASCADE, então o perfil não pode ser apagado. Recusar
      // AQUI, antes do audit_log e de qualquer delete (os deletes abaixo são
      // separados, sem transação: sem esta checagem tudo seria apagado e só o
      // perfil falharia no fim). Se a checagem falhar, também recusa.
      const { count: receiptCount, error: receiptErr } = await supabaseClient
        .from('insurance_receipts')
        .select('id', { count: 'exact', head: true })
        .eq('student_id', studentId)
      if (receiptErr || typeof receiptCount !== 'number') {
        throw new Error('Could not check insurance receipts; student was not deleted')
      }
      if (receiptCount > 0) {
        return new Response(
          JSON.stringify({
            error: 'Student has insurance receipts and cannot be permanently deleted',
            code: 'STUDENT_HAS_RECEIPTS',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 409 }
        )
      }

      // Ficha de saúde guardada (inclusive congelada após a retirada do
      // consentimento) tem prazo de guarda exigido pelo seguro: o FK em
      // CASCADE a destruiria junto. Recusar até a professora apagá-la pelo
      // botão "Apagar ficha de saúde" (RPC delete_health_profile, auditada).
      // Só a contagem: nenhum dado de saúde é lido nem registrado em log.
      const { count: healthCount, error: healthErr } = await supabaseClient
        .from('student_health_profiles')
        .select('student_id', { count: 'exact', head: true })
        .eq('student_id', studentId)
      if (healthErr || typeof healthCount !== 'number') {
        throw new Error('Could not check health profile; student was not deleted')
      }
      if (healthCount > 0) {
        return new Response(
          JSON.stringify({
            error: 'Student has a kept health profile and cannot be permanently deleted',
            code: 'STUDENT_HAS_HEALTH_PROFILE',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 409 }
        )
      }

      // Aceites do termo são guardados por pelo menos 5 anos (ou o prazo da
      // lei do Québec), mesmo depois que o aluno sai: o FK em CASCADE os
      // apagaria. Recusar até existir uma purga no fim do prazo. Só a contagem.
      const { count: consentCount, error: consentErr } = await supabaseClient
        .from('consent_acceptances')
        .select('id', { count: 'exact', head: true })
        .eq('student_id', studentId)
      if (consentErr || typeof consentCount !== 'number') {
        throw new Error('Could not check consent records; student was not deleted')
      }
      if (consentCount > 0) {
        return new Response(
          JSON.stringify({
            error: 'Student has consent records and cannot be permanently deleted',
            code: 'STUDENT_HAS_CONSENT_RECORDS',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 409 }
        )
      }

      console.log(`Starting HARD DELETE for student: ${studentId}`)

      const snapshot = await fetchProfileSnapshot()

      // Audit log FIRST — before any deletion
      await writeAuditLog('student.hard_delete', snapshot)

      // Cascade delete all related records
      const { error: linkErr } = await supabaseClient.from('student_class_link').delete().eq('student_id', studentId)
      if (linkErr) throw new Error(`Failed to delete student class links: ${linkErr.message}`)

      const { error: checkinErr } = await supabaseClient.from('check_ins').delete().eq('student_id', studentId)
      if (checkinErr) throw new Error(`Failed to delete student check-in history: ${checkinErr.message}`)

      const { error: balanceErr } = await supabaseClient.from('balance_history').delete().eq('student_id', studentId)
      if (balanceErr) throw new Error(`Failed to delete student balance history: ${balanceErr.message}`)

      const { error: emailErr } = await supabaseClient.from('email_notifications').delete().eq('student_id', studentId)
      if (emailErr) throw new Error(`Failed to delete student email notifications: ${emailErr.message}`)

      const { error: profileErr } = await supabaseClient.from('profiles').delete().eq('id', studentId)
      if (profileErr) throw new Error(`Failed to delete student profile: ${profileErr.message}`)

      const { error: authDeleteError } = await supabaseClient.auth.admin.deleteUser(studentId)
      if (authDeleteError) {
        const isNotFound = authDeleteError.message?.toLowerCase().includes('not found') || authDeleteError.status === 404
        if (!isNotFound) throw new Error(`Failed to delete student auth credentials: ${authDeleteError.message}`)
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Student permanently deleted.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // ── Action: update-email (unchanged) ─────────────────────────────────────
    if (action === 'update-email') {
      if (!email) throw new Error('email is required to update student email')

      console.log(`Updating email for student: ${studentId}`)

      const { error: authUpdateError } = await supabaseClient.auth.admin.updateUserById(
        studentId,
        { email: email, email_confirm: true }
      )
      if (authUpdateError) throw new Error(`Failed to update student auth email: ${authUpdateError.message}`)

      const { error: profileUpdateError } = await supabaseClient
        .from('profiles')
        .update({ email: email })
        .eq('id', studentId)
      if (profileUpdateError) throw new Error(`Failed to update student profile email: ${profileUpdateError.message}`)

      return new Response(
        JSON.stringify({ success: true, message: 'Student email updated successfully in auth and profile schemas' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    throw new Error(`Unsupported action: ${action}`)

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
