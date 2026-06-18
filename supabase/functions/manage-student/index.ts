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

    // ── Action: soft-delete (default "delete" from UI) ────────────────────────
    if (action === 'delete') {
      console.log(`Starting soft delete for student: ${studentId}`)

      const snapshot = await fetchProfileSnapshot()

      // Audit log BEFORE any modification
      await writeAuditLog('student.soft_delete', snapshot)

      // Remove from class schedules (student should not appear in active classes)
      const { error: linkErr } = await supabaseClient
        .from('student_class_link')
        .delete()
        .eq('student_id', studentId)
      if (linkErr) throw new Error(`Failed to remove student class links: ${linkErr.message}`)

      // Soft delete: set deleted_at + deleted_by (check_ins and balance_history preserved)
      const { error: softErr } = await supabaseClient
        .from('profiles')
        .update({ deleted_at: new Date().toISOString(), deleted_by: actorId })
        .eq('id', studentId)
      if (softErr) throw new Error(`Failed to soft-delete student profile: ${softErr.message}`)

      return new Response(
        JSON.stringify({ success: true, message: 'Student moved to trash. History preserved.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // ── Action: restore (revert soft-delete) ─────────────────────────────────
    if (action === 'restore') {
      console.log(`Restoring soft-deleted student: ${studentId}`)

      const snapshot = await fetchProfileSnapshot()

      // Audit log before restore
      await writeAuditLog('student.restore', snapshot)

      const { error: restoreErr } = await supabaseClient
        .from('profiles')
        .update({ deleted_at: null, deleted_by: null })
        .eq('id', studentId)
      if (restoreErr) throw new Error(`Failed to restore student: ${restoreErr.message}`)

      return new Response(
        JSON.stringify({ success: true, message: 'Student restored successfully.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // ── Action: hard-delete (permanent, requires friction in UI) ─────────────
    if (action === 'hard-delete') {
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

      console.log(`Updating email for student ${studentId} to: ${email}`)

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
